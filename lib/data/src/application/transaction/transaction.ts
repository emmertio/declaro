import { Context, useContext, withContext } from '@declaro/core'
import {
    TransactionStatus,
    type ITransaction,
    type ITransactionAdapter,
    type TransactionCallback,
} from '../../domain/transaction/transaction-interface'
import { useTransactionAdapter } from '../../shared/utils/transaction/use-transaction-adapter'
import type { ITransactionScope } from '../../types/transaction-context'
import { TransactionStack } from './transaction-stack'

/**
 * Options for the {@link Transaction} constructor, {@link Transaction.begin}, and {@link Transaction.run}.
 */
export interface TransactionOptions {
    /**
     * The adapter that talks to the ORM. Defaults to the one registered on `context`, or on the ambient context.
     */
    adapter?: ITransactionAdapter
    /**
     * The transaction to nest in. It must be `Active` when this one begins. By default the parent is decided when the
     * transaction begins: the current transaction if it is `Active` and uses the same adapter, otherwise none. Pass
     * `null` to force a top-level transaction.
     */
    parent?: ITransaction | null
    /**
     * The context to use instead of the ambient one: the adapter is read from it, `begin()` uses its transaction
     * stack, and `run()` callbacks run in a child of it.
     */
    context?: Context
}

/**
 * The operations that change a transaction's status.
 */
type TransactionOperation = 'begin' | 'commit' | 'rollback'

/**
 * The operations that finish a transaction, and cascade to everything begun after it.
 */
type FinishOperation = Exclude<TransactionOperation, 'begin'>

/**
 * Links each run's transaction stack to the stack of the context the run was started from, so a commit or rollback
 * called from inside nested runs can find the transactions those runs began.
 */
const outerStacks = new WeakMap<TransactionStack, TransactionStack>()

/**
 * Counts successful begins, so a cascade can tell which transactions on other stacks were begun after its target.
 */
let beginCount = 0

/**
 * A single transaction. One instance is one transaction, and it is used once.
 *
 * It owns the lifecycle state machine and guards against invalid transitions, and delegates the ORM calls to its
 * {@link ITransactionAdapter}. The status only changes after the adapter call resolves, so a call that throws leaves
 * the transaction where it was. For example, a failed commit leaves it `Active` and current, so it can still be rolled
 * back.
 *
 * Transactions form a stack per async flow (see {@link TransactionStack}): `begin()` makes a transaction current, and
 * `commit()` or `rollback()` makes whatever was current before it current again.
 *
 * The outer transaction takes precedence: `commit()` and `rollback()` first commit or roll back everything begun after
 * the transaction in the same flow, innermost first, then the transaction itself. That includes transactions begun on
 * its stack that aren't its children, and, when called from inside a nested run, the transactions of the runs between
 * the caller and the transaction. A child still open in a concurrent flow, which the cascade can't reach, makes both
 * throw before anything is touched.
 *
 * Most code should use {@link Transaction.run}, which begins, commits, and rolls back for you.
 *
 * @example
 * ```ts
 * const order = await Transaction.run(async () => {
 *     const order = await orderService.create(input)
 *     await inventoryService.reserve(order.items) // rolls back the order too if this throws
 *     return order
 * })
 * ```
 */
export class Transaction implements ITransaction {
    private readonly adapter: ITransactionAdapter
    private readonly context?: Context
    private readonly requestedParent?: ITransaction | null
    private currentParent?: ITransaction
    private stack?: TransactionStack
    private currentStatus = TransactionStatus.Pending
    private operationInProgress?: TransactionOperation
    private readonly openChildren = new Set<ITransaction>()
    private beginOrder = 0

    /**
     * Creates a pending transaction. It does not take part in any stack until {@link Transaction.begin | begin()}.
     *
     * @param options - Optional overrides. By default the adapter comes from the ambient context, and the parent is
     *   decided when the transaction begins.
     * @throws {Error} If no adapter is passed and none can be found on the context.
     */
    constructor(options: TransactionOptions = {}) {
        this.adapter =
            options.adapter ??
            (options.context ? withContext(options.context, () => useTransactionAdapter()) : useTransactionAdapter())
        this.context = options.context
        this.requestedParent = options.parent
    }

    /**
     * Creates and begins a new transaction, for manual control. The transaction is current afterwards: until it is
     * committed or rolled back, `useTransaction()` returns it and new transactions nest in it.
     *
     * @param options - Same as the {@link Transaction} constructor.
     * @returns The active transaction. Commit or roll it back yourself.
     * @throws {Error} If no adapter or transaction stack can be found, or if the adapter fails to begin.
     *
     * @example
     * ```ts
     * const transaction = await Transaction.begin()
     * try {
     *     await doWork()
     *     await transaction.commit()
     * } catch (error) {
     *     await transaction.rollback()
     *     throw error
     * }
     * ```
     */
    static async begin(options?: TransactionOptions): Promise<Transaction> {
        const transaction = new Transaction(options)
        await transaction.begin()
        return transaction
    }

    /**
     * Runs `callback` in a new transaction, committing on success and rolling back if it throws.
     *
     * - If the current transaction is `Active` and uses the same adapter, the new one nests inside it (usually a
     *   savepoint). Otherwise it is top-level. Pass `parent` to choose, or `parent: null` to force top-level.
     * - The callback runs in a child context with its own {@link TransactionStack}, so `useTransaction()` returns the
     *   new transaction while it runs, and concurrent runs stay isolated. The run's adapter is registered on that
     *   context as `transactionAdapter`, so `useTransactionAdapter()` and nested transactions find it.
     * - If `callback` commits or rolls back the transaction itself, it is left alone. That includes a cascade from an
     *   outer transaction finishing it.
     * - If `callback` returns while transactions it began are still open, the commit cascades and commits them too.
     *
     * @param callback - The work to run.
     * @param options - Same as the {@link Transaction} constructor.
     * @returns Whatever `callback` returns.
     * @throws {Error} Whatever `callback` throws, after rolling back.
     * @throws {Error} If the commit fails, after rolling back.
     * @throws {AggregateError} If rolling back after a failure also fails. Holds both errors.
     */
    static run<TResult>(callback: TransactionCallback<TResult>, options: TransactionOptions = {}): Promise<TResult> {
        const ambient = options.context ?? useContext()
        const adapter =
            options.adapter ?? (ambient ? withContext(ambient, () => useTransactionAdapter()) : useTransactionAdapter())

        let parent = options.parent
        if (parent === undefined) {
            const current = (ambient as Context<ITransactionScope> | null)?.resolve('transactionStack')?.current
            parent = current && isActive(current) && Transaction.usesAdapter(current, adapter) ? current : null
        }

        return Transaction.runInNewStack(callback, { adapter, parent }, ambient)
    }

    /** The current lifecycle state. */
    get status(): TransactionStatus {
        return this.currentStatus
    }

    /** The transaction this one is nested in, if any. Decided by `begin()`, so always `undefined` before it. */
    get parent(): ITransaction | undefined {
        return this.currentParent
    }

    /** How deeply this transaction is nested. `0` for a top-level transaction, and before `begin()`. */
    get depth(): number {
        return this.currentParent ? this.currentParent.depth + 1 : 0
    }

    /**
     * Starts the transaction and makes it current on its context's transaction stack.
     *
     * The parent is decided here: the one passed to the constructor, or else the current transaction if it is
     * `Active` and uses the same adapter, or else none.
     *
     * Nested transactions share their parent's connection, where savepoints form a single stack, so a parent can only
     * have one flow of children at a time. Beginning a child while the parent already has an active child (or one
     * still beginning) that the caller is not inside, such as a sibling started in parallel with `Promise.all`, throws
     * before the adapter is called. Run parallel work in top-level transactions (`parent: null`) instead.
     *
     * @throws {Error} If the transaction is not `Pending`, if another operation on it is in progress, if no
     *   transaction stack can be found, if an explicit parent is not `Active`, if the parent has an active child in
     *   another async flow, or if the adapter fails.
     */
    async begin(): Promise<void> {
        this.assertStatus(TransactionStatus.Pending, 'begin')
        this.assertIdle('begin')

        const stack = this.resolveStack()
        const parent = this.resolveParent(stack)
        if (parent instanceof Transaction) {
            parent.assertNoActiveChildElsewhere(stack)
        }

        this.operationInProgress = 'begin'
        this.currentParent = parent
        // Registered before the adapter call, so a concurrent begin under the same parent sees this one in flight.
        if (parent instanceof Transaction) {
            parent.openChildren.add(this)
        }
        try {
            await this.adapter.begin(this)
        } catch (error) {
            if (parent instanceof Transaction) {
                parent.openChildren.delete(this)
            }
            this.currentParent = undefined
            throw error
        } finally {
            this.operationInProgress = undefined
        }

        this.currentStatus = TransactionStatus.Active
        this.beginOrder = ++beginCount
        this.stack = stack
        stack.push(this)
    }

    /**
     * Commits the transaction, and makes whatever was current before it current again.
     *
     * Everything begun after it in the same flow is committed first, innermost first, each through its own `commit()`:
     * the transactions above it on its stack, whether or not they are its children, and, when called from inside a
     * nested run, the transactions of the runs between the caller and this one. If one of those commits fails, the
     * cascade stops there and this transaction stays `Active`, so it can still be rolled back.
     *
     * @throws {Error} If the transaction is not `Active`, if another operation on it is in progress, if a child is
     *   still open in another async flow (checked before anything is committed), or if a commit fails.
     */
    commit(): Promise<void> {
        return this.finishWithCascade('commit')
    }

    /**
     * Rolls the transaction back, and makes whatever was current before it current again.
     *
     * Everything begun after it in the same flow is rolled back first, innermost first, the same way
     * {@link Transaction.commit | commit()} cascades. If one of those rollbacks fails, the cascade stops there and this
     * transaction stays `Active`.
     *
     * @throws {Error} If the transaction is not `Active`, if another operation on it is in progress, if a child is
     *   still open in another async flow (checked before anything is rolled back), or if a rollback fails.
     */
    rollback(): Promise<void> {
        return this.finishWithCascade('rollback')
    }

    /**
     * Runs `callback` in a new transaction nested inside this one, committing the nested transaction on success and
     * rolling it back if `callback` throws. Behaves like {@link Transaction.run} otherwise.
     *
     * @param callback - The work to run. `useTransaction()` returns the nested transaction while it runs.
     * @returns Whatever `callback` returns.
     * @throws {Error} If this transaction is not `Active`, or whatever `callback` throws, after rolling back.
     * @throws {AggregateError} If rolling back after a failure also fails. Holds both errors.
     */
    async run<TResult>(callback: TransactionCallback<TResult>): Promise<TResult> {
        this.assertStatus(TransactionStatus.Active, 'run a child of')
        return Transaction.runInNewStack(
            callback,
            { adapter: this.adapter, parent: this },
            this.context ?? useContext(),
        )
    }

    /**
     * Begins a transaction on a new stack in a child of `ambient` that also carries the run's adapter, runs `callback`
     * in that child context, then commits or rolls back. Shared by {@link Transaction.run} and {@link Transaction.prototype.run}.
     *
     * @param callback - The work to run.
     * @param options - The adapter and the already-decided parent (`null` for top-level).
     * @param ambient - The context to derive the run's context from, if any.
     * @returns Whatever `callback` returns.
     */
    private static async runInNewStack<TResult>(
        callback: TransactionCallback<TResult>,
        options: { adapter: ITransactionAdapter; parent: ITransaction | null },
        ambient: Context | null,
    ): Promise<TResult> {
        const context = new Context<ITransactionScope>()
        if (ambient) {
            context.extend(ambient)
        }
        const stack = new TransactionStack()
        const outerStack = (ambient as Context<ITransactionScope> | null)?.resolve('transactionStack')
        if (outerStack) {
            outerStacks.set(stack, outerStack)
        }
        context.registerValue('transactionStack', stack)
        // The run's adapter may differ from the ambient one, or there may be none: expose the one the run uses.
        context.registerValue('transactionAdapter', options.adapter)

        const transaction = new Transaction({ ...options, context })
        await transaction.begin()

        let result: TResult
        try {
            result = await withContext(context, () => callback(transaction))
        } catch (error) {
            if (isActive(transaction)) {
                await rollBackAfter(transaction, error)
            }

            throw error
        }

        if (!isActive(transaction)) {
            return result
        }

        try {
            await transaction.commit()
        } catch (error) {
            if (isActive(transaction)) {
                await rollBackAfter(transaction, error)
            }

            throw error
        }

        return result
    }

    /**
     * Finds the transaction stack `begin()` pushes onto: the one on the explicit context, or on the ambient one.
     */
    private resolveStack(): TransactionStack {
        const context = (this.context ?? useContext()) as Context<ITransactionScope> | null
        const stack = context?.resolve('transactionStack')

        if (!stack) {
            throw new Error(
                'No transaction stack was found in the current context. Use Transaction.run(), or begin transactions inside a request context set up by transactionModule().',
            )
        }

        return stack
    }

    /**
     * Decides the parent at `begin()`: the explicit one, which must be `Active`, or else the stack's current
     * transaction when it is `Active` and uses the same adapter.
     */
    private resolveParent(stack: TransactionStack): ITransaction | undefined {
        if (this.requestedParent === null) {
            return undefined
        }

        if (this.requestedParent) {
            if (!isActive(this.requestedParent)) {
                throw new Error(`Cannot begin a transaction nested in a parent that is ${this.requestedParent.status}`)
            }

            return this.requestedParent
        }

        const current = stack.current
        return current && isActive(current) && Transaction.usesAdapter(current, this.adapter) ? current : undefined
    }

    /**
     * Commits or rolls back everything begun after this transaction in the same flow, innermost first, then this
     * transaction. Checks for children open in another async flow before touching anything.
     *
     * @param operation - Whether to commit or roll back.
     * @throws {Error} If the transaction can't be finished, or if finishing it or anything in the cascade fails.
     */
    private async finishWithCascade(operation: FinishOperation): Promise<void> {
        this.assertStatus(TransactionStatus.Active, operation)
        this.assertIdle(operation)

        const cascade = this.planCascade(useCurrentStack())
        const members = new Set<ITransaction>([this, ...cascade])
        for (const member of members) {
            if (member instanceof Transaction) {
                member.assertNoChildrenOutside(members, operation)
            }
        }

        this.operationInProgress = operation
        try {
            for (const transaction of cascade) {
                await transaction[operation]()
            }

            await this.adapter[operation](this)
        } finally {
            this.operationInProgress = undefined
        }

        this.finish(operation === 'commit' ? TransactionStatus.Committed : TransactionStatus.RolledBack)
    }

    /**
     * Lists what a commit or rollback of this transaction finishes first, innermost first.
     *
     * When the caller is inside nested runs that were started within this transaction's flow (its stack is reached by
     * following the ambient stack outward), that is every transaction begun after this one on the stacks in between,
     * innermost stack first. Then come the transactions above this one on its own stack.
     *
     * @param from - The caller's transaction stack, which the walk outward starts from.
     */
    private planCascade(from: TransactionStack | undefined): ITransaction[] {
        const cascade: ITransaction[] = []
        const innerStacks: TransactionStack[] = []
        let stack = from

        while (stack && stack !== this.stack) {
            innerStacks.push(stack)
            stack = outerStacks.get(stack)
        }

        if (stack) {
            for (const inner of innerStacks) {
                const begunAfter = inner
                    .all()
                    .filter((entry) => entry instanceof Transaction && entry.beginOrder > this.beginOrder)
                cascade.push(...begunAfter.reverse())
            }
        }

        cascade.push(...(this.stack?.above(this) ?? []).reverse())
        return cascade
    }

    /**
     * Throws if a child of this transaction is open outside of `members`, which a cascade can't reach because it runs
     * in another async flow.
     */
    private assertNoChildrenOutside(members: Set<ITransaction>, operation: FinishOperation) {
        const elsewhere = [...this.openChildren].filter((child) => !members.has(child)).length

        if (elsewhere > 0) {
            throw new Error(
                `Cannot ${operation} a transaction with ${elsewhere} open child transaction(s) in another async flow`,
            )
        }
    }

    /**
     * Throws if this transaction has an open child that a caller on `stack` is not inside, which means a child is
     * begun or running in another async flow. Uses the same reach as the commit and rollback cascade.
     *
     * @param stack - The stack the new child will be pushed onto.
     */
    private assertNoActiveChildElsewhere(stack: TransactionStack) {
        if (this.openChildren.size === 0) {
            return
        }

        const reachable = new Set(this.planCascade(stack))
        if ([...this.openChildren].some((child) => !reachable.has(child))) {
            throw new Error(
                `Cannot begin a nested transaction while its parent (depth ${this.depth}) already has an active child in another async flow. Run parallel work in top-level transactions (parent: null) instead.`,
            )
        }
    }

    /**
     * Records the final status, and takes the transaction off its stack and out of its parent's open children.
     */
    private finish(status: TransactionStatus) {
        this.currentStatus = status
        this.stack?.remove(this)
        if (this.currentParent instanceof Transaction) {
            this.currentParent.openChildren.delete(this)
        }
    }

    /**
     * Throws unless the transaction is in the `expected` status.
     */
    private assertStatus(expected: TransactionStatus, action: string) {
        if (this.currentStatus !== expected) {
            throw new Error(`Cannot ${action} a transaction that is ${this.currentStatus}`)
        }
    }

    /**
     * Throws if a `begin()`, `commit()`, or `rollback()` on this transaction is still in flight.
     */
    private assertIdle(action: TransactionOperation) {
        if (this.operationInProgress) {
            throw new Error(`Cannot ${action} a transaction while another operation on it is in progress`)
        }
    }

    /**
     * Checks whether `transaction` is a {@link Transaction} run by `adapter`. Compares adapters by identity.
     */
    private static usesAdapter(transaction: ITransaction, adapter: ITransactionAdapter): boolean {
        return transaction instanceof Transaction && transaction.adapter === adapter
    }
}

/**
 * Rolls `transaction` back after `error`, and rethrows both as an `AggregateError` if the rollback fails too.
 */
async function rollBackAfter(transaction: ITransaction, error: unknown) {
    try {
        await transaction.rollback()
    } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], 'Transaction failed, and so did its rollback')
    }
}

/**
 * The transaction stack of the ambient context, if any.
 */
function useCurrentStack(): TransactionStack | undefined {
    return (useContext() as Context<ITransactionScope> | null)?.resolve('transactionStack')
}

/**
 * Reads the status fresh. The callback can change it, which TypeScript's narrowing doesn't know about.
 */
function isActive(transaction: ITransaction) {
    return transaction.status === TransactionStatus.Active
}
