import type { AmbientTransactionOptions } from './transaction'
import type { TransactionScope } from './transaction-scope'
import { resolveTransactionManager } from './transaction-session'

/**
 * Registers a callback with a test framework hook such as `beforeEach`.
 */
export type TestHookRegistrar = (fn: () => any) => any

/**
 * The subset of a test framework's API the transactional test helper needs.
 * Satisfied by `bun:test`, vitest and jest.
 */
export interface TransactionalTestHooks {
    /** Runs before every test in the suite. */
    beforeEach: TestHookRegistrar
    /** Runs after every test in the suite. */
    afterEach: TestHookRegistrar
}

/**
 * Handle returned by {@link useTransactionalTests}, exposing the transaction
 * wrapping the current test.
 */
export interface TransactionalTestHandle {
    /** The transaction wrapping the current test, or `null` between tests. */
    current(): TransactionScope | null
}

// A rollback can never need more unwinding steps than this; the guard only
// exists so a misbehaving adapter cannot spin the loop forever.
const MAX_UNWIND_STEPS = 100

/**
 * Wrap every test in a suite in a transaction that is rolled back once the
 * test finishes, so integration tests share one database without leaking state
 * between them.
 *
 * Any nested transaction the test forgot to settle is rolled back too.
 *
 * @param hooks - The test framework's `beforeEach` and `afterEach`.
 * @param options - Propagation, isolation level and manager override.
 * @returns A handle exposing the transaction wrapping the current test.
 *
 * @example
 * ```ts
 * import { afterEach, beforeEach, describe, it } from 'bun:test'
 *
 * describe('OrderService', () => {
 *     useTransactionalTests({ beforeEach, afterEach }, { manager })
 *
 *     it('creates an order', async () => {
 *         await orders.create(input) // rolled back once the test ends
 *     })
 * })
 * ```
 */
export function useTransactionalTests(
    hooks: TransactionalTestHooks,
    options: AmbientTransactionOptions = {},
): TransactionalTestHandle {
    let scope: TransactionScope | null = null

    hooks.beforeEach(async () => {
        const manager = resolveTransactionManager(options.manager)
        scope = await manager.start(options)
    })

    hooks.afterEach(async () => {
        const startedScope = scope
        scope = null
        if (!startedScope) return

        const manager = resolveTransactionManager(options.manager)

        for (let step = 0; startedScope.isActive && step < MAX_UNWIND_STEPS; step++) {
            await manager.rollback()
        }
    })

    return {
        current: () => scope,
    }
}
