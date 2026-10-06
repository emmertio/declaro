/**
 * Rollback helpers for Bun's test runner, published as `@declaro/data/testing/bun`.
 *
 * Bun's `beforeEach` and `afterEach` aren't on `globalThis`, so the main entry's `rollbackEachTest` needs them passed as
 * `options.hooks`. This entry imports them from `bun:test` itself, so a Bun test file only passes the context. It
 * imports `bun:test`, so only import it from Bun test files. The main `@declaro/data` entry never imports it.
 *
 * @module
 */
import type { Context } from '@declaro/core'
import { afterEach, beforeEach } from 'bun:test'
// The build maps this import to `@declaro/data`, so this entry shares the main entry's code instead of bundling a copy.
import {
    rollbackEachTest as rollbackEachTestWithHooks,
    type ITransactionScope,
    type RollbackEachTestOptions,
    type RollbackTestSuite,
} from '../index'

export { rollbackTest, withRollback } from '../index'
export type { RollbackTestSuite } from '../index'

/**
 * Options for the Bun {@link rollbackEachTest}: the main entry's options without `hooks`, which come from `bun:test`.
 */
export type BunRollbackEachTestOptions = Omit<RollbackEachTestOptions, 'hooks'>

/**
 * Rolls back every test in a suite, registering its hooks with `beforeEach` and `afterEach` from `bun:test`.
 *
 * Same as the main entry's `rollbackEachTest(context, { hooks: { beforeEach, afterEach } })`: before each test it
 * registers a new `TransactionStack` on `context` and begins a top-level transaction on it, and after each test it
 * rolls that transaction back, cascading to any transaction the test left open, whether the test passed or failed.
 * Code the test runs in `context` sees the test's transaction as current and nests in it, so nested commits are
 * rolled back too. Tests sharing `context` must run one after another (no `test.concurrent`).
 *
 * Call it inside a `describe` block (or at the top level of the test file) so the hooks apply to that suite.
 *
 * @param context - The context the tests run their code in, usually the app context. Its `transactionAdapter` runs
 *   the test transactions.
 * @param options - Optional. The main entry's options, without `hooks`.
 * @returns A getter for the current test's transaction.
 * @throws {Error} From `beforeEach`, if no adapter is registered on `context`.
 * @throws {Error} From `afterEach`, if the test committed its own transaction, since its changes were not rolled back.
 *
 * @example
 * ```ts
 * import { withContext } from '@declaro/core'
 * import { rollbackEachTest } from '@declaro/data/testing/bun'
 * import { describe, expect, it } from 'bun:test'
 *
 * describe('orders', () => {
 *     const suite = rollbackEachTest(app)
 *
 *     it('creates an order', () =>
 *         withContext(app, async () => {
 *             const order = await orderService.create(input)
 *             expect(await orderService.load(order.id)).toBeDefined()
 *         }),
 *     )
 * })
 * ```
 */
export function rollbackEachTest<TScope extends ITransactionScope>(
    context: Context<TScope>,
    options: BunRollbackEachTestOptions = {},
): RollbackTestSuite {
    return rollbackEachTestWithHooks(context, { ...options, hooks: { beforeEach, afterEach } })
}
