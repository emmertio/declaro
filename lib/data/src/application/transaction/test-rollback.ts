import { Context, withContext, type EventManager } from '@declaro/core'
import {
    TransactionStatus,
    type ITransaction,
    type ITransactionAdapter,
    type TransactionCallback,
} from '../../domain/transaction/transaction-interface'
import type { ITransactionScope } from '../../types/transaction-context'
import { Transaction, type TransactionOptions } from './transaction'
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
     * The adapter the test transactions use. It is also registered on the test context as `transactionAdapter`, so
     * code under test nests in the test's transaction. Defaults to the one registered on `context`.
     */
    adapter?: ITransactionAdapter
    /**
     * The context the test context extends, usually the app context. Its dependencies and event listeners are copied
     * into the test context when {@link rollbackEachTest} is called.
     */
    context?: Context
    /** Where to emit the test transactions' lifecycle events. Defaults to the test context's `events`. */
    emitter?: EventManager
}

/**
 * What {@link rollbackEachTest} returns: the context to run each test's code in, and the test's transaction.
 */
export interface RollbackTestSuite {
    /**
     * The test context. Run the code under test in it with `withContext(context, ...)`, so the test's transaction is
     * current. It is the same context for every test in the suite, with a new {@link TransactionStack} each test.
     */
    readonly context: Context<ITransactionScope>
    /**
     * The current test's transaction.
     *
     * @throws {Error} If read outside a test (before `beforeEach` has run, or after `afterEach`).
     */
    readonly transaction: ITransaction
}

/**
 * Runs `fn` in a transaction that is always rolled back afterwards, so an integration test against a real database
 * leaves no data behind.
 *
 * The transaction is top-level unless `parent` is passed. `fn` runs in a child context where it is current, so
 * `useTransaction()` returns it and transactions begun by the code under test nest in it.
 *
 * - **Nested commits are rolled back too.** Code under test that commits a nested transaction only saves into the
 *   test's transaction, so the final rollback still undoes it.
 * - **A new top-level transaction escapes.** Code that begins its own top-level transaction (`parent: null`, or a
 *   `Transaction.run()` outside the context `fn` runs in) commits for real.
 * - **`afterCommit` callbacks never run**, because the test's transaction never commits.
 *
 * @param fn - The test body. Receives the test's transaction.
 * @param options - Passed to `Transaction.run()`: `adapter`, `context`, `parent` (defaults to `null`, top-level) and
 *   `emitter`.
 * @returns Whatever `fn` returns, after the rollback.
 * @throws {Error} Whatever `fn` throws, after the rollback.
 * @throws {Error} If `fn` committed the test's transaction itself, since its changes were not rolled back.
 * @throws {AggregateError} If `fn` throws and the rollback fails too. Holds both errors.
 *
 * @example
 * ```ts
 * it('creates an order', () =>
 *     withRollback(async () => {
 *         const order = await orderService.create(input)
 *         expect(await orderService.load(order.id)).toBeDefined()
 *     }, { context: app }),
 * )
 * ```
 */
export function withRollback<TResult>(
    fn: TransactionCallback<TResult>,
    options: TransactionOptions = {},
): Promise<TResult> {
    return Transaction.run(
        async (transaction) => {
            // If `fn` throws, `Transaction.run` rolls back and rethrows.
            const result = await fn(transaction)
            if (transaction.status === TransactionStatus.Active) {
                await transaction.rollback()
            }
            assertNotCommitted(transaction)

            return result
        },
        { ...options, parent: options.parent ?? null },
    )
}

/**
 * Wraps a test body so it runs through {@link withRollback}: in a transaction that is always rolled back afterwards.
 * Pass the result straight to the test framework's `it` or `test`.
 *
 * The returned function takes no arguments, so frameworks don't mistake it for a `done`-callback test.
 *
 * @param fn - The test body. Receives the test's transaction.
 * @param options - Same as {@link withRollback}.
 * @returns A test function that returns a promise of `fn`'s result.
 *
 * @example
 * ```ts
 * it('creates an order', rollbackTest(async () => {
 *     const order = await orderService.create(input)
 *     expect(await orderService.load(order.id)).toBeDefined()
 * }, { context: app }))
 * ```
 */
export function rollbackTest<TResult>(
    fn: TransactionCallback<TResult>,
    options?: TransactionOptions,
): () => Promise<TResult> {
    return () => withRollback(fn, options)
}

/**
 * Rolls back every test in a suite: registers a `beforeEach` hook that begins a top-level transaction, and an
 * `afterEach` hook that rolls it back, cascading to any transaction the test left open.
 *
 * A `beforeEach` hook can't make a transaction current for the test body through the ambient context, so the
 * transaction lives on the {@link RollbackTestSuite.context | test context} instead: a child of `options.context` with
 * its own {@link TransactionStack}. Run the code under test with `withContext(suite.context, ...)` to see the
 * transaction as current.
 *
 * - **Nested commits are rolled back too.** Code under test that commits a nested transaction only saves into the
 *   test's transaction, so the final rollback still undoes it.
 * - **A new top-level transaction escapes.** Code that begins its own top-level transaction (`parent: null`, or a
 *   `Transaction.run()` outside the test context) commits for real.
 * - **`afterCommit` callbacks never run**, because the test's transaction never commits.
 *
 * The `afterEach` hook throws if the test committed its transaction itself, since its changes were not rolled back.
 *
 * @param hooks - The framework's `beforeEach` and `afterEach`.
 * @param options - The context to extend, and the adapter and emitter for the test transactions.
 * @returns The test context and a getter for the current test's transaction.
 * @throws {Error} From `beforeEach`, if no adapter is passed and none is registered on `options.context`.
 *
 * @example
 * ```ts
 * import { afterEach, beforeEach, describe, it } from 'bun:test'
 *
 * describe('orders', () => {
 *     const suite = rollbackEachTest({ beforeEach, afterEach }, { context: app })
 *
 *     it('creates an order', () =>
 *         withContext(suite.context, async () => {
 *             await orderService.create(input)
 *         }),
 *     )
 * })
 * ```
 */
export function rollbackEachTest(hooks: RollbackTestHooks, options: RollbackEachTestOptions = {}): RollbackTestSuite {
    const context = new Context<ITransactionScope>()
    if (options.context) {
        context.extend(options.context)
    }
    if (options.adapter) {
        context.registerValue('transactionAdapter', options.adapter)
    }
    context.registerValue('transactionStack', new TransactionStack())

    let current: Transaction | undefined

    hooks.beforeEach(async () => {
        context.registerValue('transactionStack', new TransactionStack())
        current = await Transaction.begin({
            adapter: options.adapter,
            context,
            emitter: options.emitter,
            parent: null,
        })
    })

    hooks.afterEach(async () => {
        const transaction = current
        current = undefined
        if (!transaction) {
            return
        }

        if (transaction.status === TransactionStatus.Active) {
            await withContext(context, () => transaction.rollback())
        }
        assertNotCommitted(transaction)
    })

    return {
        context,
        get transaction(): ITransaction {
            if (!current) {
                throw new Error(
                    'No test transaction is active. Read it inside a test of the suite that called rollbackEachTest().',
                )
            }

            return current
        },
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
