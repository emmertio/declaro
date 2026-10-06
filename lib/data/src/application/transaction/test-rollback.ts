import { withContext, type Context, type ContextAttribute } from '@declaro/core'
import {
    TransactionStatus,
    type ITransaction,
    type TransactionCallback,
} from '../../domain/transaction/transaction-interface'
import type { ITransactionScope } from '../../types/transaction-context'
import { Transaction } from './transaction'
import { TransactionStack } from './transaction-stack'

/**
 * Registers a hook with a test framework, such as `beforeEach` or `afterEach` from `bun:test`, Vitest or Jest.
 */
export type TestHookRegistrar = (hook: () => Promise<void>) => unknown

/**
 * The test framework hooks {@link rollbackEachTest} registers through. Pass the framework's own functions, so this
 * package never imports a test framework.
 */
export interface RollbackTestHooks {
    /** Registers a hook that runs before each test, such as `beforeEach` from `bun:test`. */
    beforeEach: TestHookRegistrar
    /** Registers a hook that runs after each test, such as `afterEach` from `bun:test`. */
    afterEach: TestHookRegistrar
}

/**
 * Options for {@link rollbackEachTest}.
 */
export interface RollbackEachTestOptions {
    /**
     * The framework's `beforeEach` and `afterEach`. Defaults to the global `beforeEach` and `afterEach`, which Jest
     * defines, and Vitest with `globals: true`. Bun's test globals are not on `globalThis`, so pass them with Bun.
     */
    hooks?: RollbackTestHooks
}

/**
 * What {@link rollbackEachTest} returns: a getter for the current test's transaction.
 */
export interface RollbackTestSuite {
    /**
     * The current test's transaction.
     *
     * @throws {Error} If read outside a test (before `beforeEach` has run, or after `afterEach`).
     */
    readonly transaction: ITransaction
}

/**
 * The test transaction on a context, and the `transactionStack` registration it replaced.
 */
interface TestTransaction {
    /** The test's top-level transaction. */
    transaction: Transaction
    /** What was registered as `transactionStack` on the context before the test, if anything. */
    previousStack?: ContextAttribute<Context<ITransactionScope>, TransactionStack>
}

/**
 * Runs `fn` in `context` (with `withContext(context, ...)`), in a top-level transaction that is always rolled back
 * afterwards, so an integration test against a real database leaves no data behind.
 *
 * The transaction lives on `context` itself: a new {@link TransactionStack} is registered on it for the length of the
 * call, and the previous `transactionStack` registration is restored afterwards (or, if there was none, `context` is
 * left with no stack again, so transactions begun directly in it are stateless as before). The adapter and the event manager are the ones registered on `context`. So `useTransaction()`
 * returns the test's transaction in `fn`, and everything that runs in `context` nests in it:
 *
 * - **Nested commits are rolled back too.** Code under test that commits a nested transaction only saves into the
 *   test's transaction, so the final rollback still undoes it.
 * - **Requests nest too.** A request context created from `context` (`createRequestContext(context, ...)`, with
 *   `transactionModule()`) starts nested under the test's transaction, so its transactions are rolled back with it,
 *   including any it left open.
 * - **A new top-level transaction escapes.** Code that begins its own top-level transaction (`parent: null`, or a
 *   `Transaction.run()` in a context that is not `context` and was not derived from it during the call) commits for
 *   real.
 * - **`afterCommit` callbacks never run**, because the test's transaction never commits.
 *
 * Since the transaction is registered on a shared context, tests using the same context must run one after another:
 * concurrent tests (`test.concurrent`) are not supported.
 *
 * @param context - The context to run `fn` in, usually the app context. Its `transactionAdapter` runs the transaction.
 * @param fn - The test body. Receives the test's transaction.
 * @returns Whatever `fn` returns, after the rollback.
 * @throws {Error} If no adapter is registered on `context`, or the transaction fails to begin.
 * @throws {Error} Whatever `fn` throws, after the rollback.
 * @throws {Error} If `fn` committed the test's transaction itself, since its changes were not rolled back.
 * @throws {AggregateError} If `fn` throws and the rollback fails too. Holds both errors.
 *
 * @example
 * ```ts
 * it('creates an order', () =>
 *     withRollback(app, async () => {
 *         const order = await orderService.create(input)
 *         expect(await orderService.load(order.id)).toBeDefined()
 *     }),
 * )
 * ```
 */
export async function withRollback<TScope extends ITransactionScope, TResult>(
    context: Context<TScope>,
    fn: TransactionCallback<TResult>,
): Promise<TResult> {
    const test = await beginTestTransaction(context)

    let result: TResult
    try {
        result = await withContext(context, () => fn(test.transaction))
    } catch (error) {
        try {
            await endTestTransaction(context, test)
        } catch (rollbackError) {
            throw new AggregateError([error, rollbackError], 'Transaction failed, and so did its rollback')
        }

        throw error
    }

    await endTestTransaction(context, test)
    assertNotCommitted(test.transaction)

    return result
}

/**
 * Wraps a test body so it runs through {@link withRollback}: in `context`, in a transaction that is always rolled back
 * afterwards. Pass the result straight to the test framework's `it` or `test`.
 *
 * The returned function takes no arguments, so frameworks don't mistake it for a `done`-callback test.
 *
 * @param context - Same as {@link withRollback}.
 * @param fn - The test body. Receives the test's transaction.
 * @returns A test function that returns a promise of `fn`'s result.
 *
 * @example
 * ```ts
 * it('creates an order', rollbackTest(app, async () => {
 *     const order = await orderService.create(input)
 *     expect(await orderService.load(order.id)).toBeDefined()
 * }))
 * ```
 */
export function rollbackTest<TScope extends ITransactionScope, TResult>(
    context: Context<TScope>,
    fn: TransactionCallback<TResult>,
): () => Promise<TResult> {
    return () => withRollback(context, fn)
}

/**
 * Rolls back every test in a suite: registers a `beforeEach` hook that begins a top-level transaction on `context`,
 * and an `afterEach` hook that rolls it back, cascading to any transaction the test left open, whether the test passed
 * or failed.
 *
 * The transaction lives on `context` itself: `beforeEach` registers a new {@link TransactionStack} on it, and
 * `afterEach` restores the previous `transactionStack` registration (or, if there was none, leaves `context` with no
 * stack again, so transactions begun directly in it are stateless as before). The adapter and the event manager are the ones
 * registered on `context`. So code the test runs in `context` (`withContext(context, ...)`, or services resolved from
 * it and called inside it) sees the test's transaction as current and nests in it:
 *
 * - **Nested commits are rolled back too.** Code under test that commits a nested transaction only saves into the
 *   test's transaction, so the final rollback still undoes it.
 * - **Requests nest too.** A request context created from `context` during the test
 *   (`createRequestContext(context, ...)`, with `transactionModule()`) starts nested under the test's transaction, so
 *   its transactions are rolled back with it, including any it left open.
 * - **A new top-level transaction escapes.** Code that begins its own top-level transaction (`parent: null`, or a
 *   `Transaction.run()` in a context that is not `context` and was not derived from it during the test) commits for
 *   real.
 * - **`afterCommit` callbacks never run**, because the test's transaction never commits.
 *
 * Since the transaction is registered on a shared context, the tests using it must run one after another: concurrent
 * tests (`test.concurrent`) are not supported.
 *
 * The `afterEach` hook throws if the test committed its transaction itself, since its changes were not rolled back.
 *
 * @param context - The context the tests run their code in, usually the app context. Its `transactionAdapter` runs
 *   the test transactions.
 * @param options - Optional. `hooks` overrides the global `beforeEach` and `afterEach`.
 * @returns A getter for the current test's transaction.
 * @throws {Error} If no hooks are passed and the global `beforeEach` and `afterEach` are not defined.
 * @throws {Error} From `beforeEach`, if no adapter is registered on `context`.
 *
 * @example
 * ```ts
 * import { afterEach, beforeEach, describe, it } from 'bun:test'
 *
 * describe('orders', () => {
 *     const suite = rollbackEachTest(app, { hooks: { beforeEach, afterEach } })
 *
 *     it('creates an order', () =>
 *         withContext(app, async () => {
 *             await orderService.create(input)
 *         }),
 *     )
 * })
 * ```
 */
export function rollbackEachTest<TScope extends ITransactionScope>(
    context: Context<TScope>,
    options: RollbackEachTestOptions = {},
): RollbackTestSuite {
    const hooks = options.hooks ?? useGlobalHooks()

    let current: TestTransaction | undefined

    hooks.beforeEach(async () => {
        current = await beginTestTransaction(context)
    })

    hooks.afterEach(async () => {
        const test = current
        current = undefined
        if (!test) {
            return
        }

        await endTestTransaction(context, test)
        assertNotCommitted(test.transaction)
    })

    return {
        get transaction(): ITransaction {
            if (!current) {
                throw new Error(
                    'No test transaction is active. Read it inside a test of the suite that called rollbackEachTest().',
                )
            }

            return current.transaction
        },
    }
}

/**
 * Gets the global `beforeEach` and `afterEach`.
 *
 * @throws {Error} If either is not defined globally.
 */
function useGlobalHooks(): RollbackTestHooks {
    const globals = globalThis as { beforeEach?: unknown; afterEach?: unknown }
    const { beforeEach, afterEach } = globals

    if (typeof beforeEach !== 'function' || typeof afterEach !== 'function') {
        throw new Error(
            "rollbackEachTest() found no global beforeEach and afterEach. Pass them with rollbackEachTest(context, { hooks: { beforeEach, afterEach } }) (needed with Bun, whose test globals are not on globalThis), or enable your test framework's globals (Vitest: globals: true).",
        )
    }

    return { beforeEach: beforeEach as TestHookRegistrar, afterEach: afterEach as TestHookRegistrar }
}

/**
 * Registers a new transaction stack on `context` and begins a top-level transaction on it.
 *
 * @throws {Error} If the transaction fails to begin, after restoring the previous stack registration.
 */
async function beginTestTransaction<TScope extends ITransactionScope>(
    scopedContext: Context<TScope>,
): Promise<TestTransaction> {
    const context = scopedContext as unknown as Context<ITransactionScope>
    const previousStack = context.introspect('transactionStack')
    context.registerValue('transactionStack', new TransactionStack())

    try {
        const transaction = await withContext(context, () => Transaction.begin({ parent: null }))
        return { transaction, previousStack }
    } catch (error) {
        restoreStack(context, previousStack)
        throw error
    }
}

/**
 * Rolls back the test's transaction if it is still `Active`, cascading to whatever the test left open, then restores
 * the previous stack registration, even if the rollback fails.
 */
async function endTestTransaction<TScope extends ITransactionScope>(
    scopedContext: Context<TScope>,
    test: TestTransaction,
): Promise<void> {
    const context = scopedContext as unknown as Context<ITransactionScope>
    try {
        if (test.transaction.status === TransactionStatus.Active) {
            await withContext(context, () => test.transaction.rollback())
        }
    } finally {
        restoreStack(context, test.previousStack)
    }
}

/**
 * Puts back the `transactionStack` registration a test replaced. A context can't unregister a dependency, so when
 * there was none, `undefined` is registered instead: `resolve()` then yields no stack, and transactions begun in the
 * context are stateless again, as they were before the test.
 */
function restoreStack(
    context: Context<ITransactionScope>,
    previousStack: ContextAttribute<Context<ITransactionScope>, TransactionStack> | undefined,
) {
    if (previousStack) {
        context.register('transactionStack', previousStack)
    } else {
        context.registerValue('transactionStack', undefined as unknown as TransactionStack)
    }
}

/**
 * Throws if a test committed its own transaction, which means its changes were saved rather than rolled back.
 */
function assertNotCommitted(transaction: ITransaction) {
    if (transaction.status === TransactionStatus.Committed) {
        throw new Error(
            "The test committed its own transaction, so its changes were not rolled back. Don't commit the test's transaction; commit nested transactions instead.",
        )
    }
}
