import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { MockTransactionAdapter } from './test/mock-transaction-adapter'
import { useTransactionalTests, type TransactionalTestHooks } from './test-transaction'
import { transaction } from './transaction'
import { TransactionManager } from './transaction-manager'
import { TransactionStatus } from './transaction-scope'
import { resetTransactionState } from './transaction-session'

/**
 * Stands in for a test framework so the helper's own hooks can be driven
 * explicitly, in order, from inside a single test.
 */
function createFakeHooks() {
    const before: (() => any)[] = []
    const after: (() => any)[] = []

    const hooks: TransactionalTestHooks = {
        beforeEach: (fn) => before.push(fn),
        afterEach: (fn) => after.push(fn),
    }

    return {
        hooks,
        runBeforeEach: async () => {
            for (const fn of before) await fn()
        },
        runAfterEach: async () => {
            for (const fn of after) await fn()
        },
    }
}

describe('useTransactionalTests', () => {
    let adapter: MockTransactionAdapter
    let manager: TransactionManager<any>

    beforeEach(() => {
        resetTransactionState()
        adapter = new MockTransactionAdapter()
        manager = new TransactionManager(adapter, { onError: () => {} })
    })

    it('wraps each test in a transaction and rolls it back afterwards', async () => {
        const { hooks, runBeforeEach, runAfterEach } = createFakeHooks()
        const handle = useTransactionalTests(hooks, { manager })

        await runBeforeEach()

        const scope = handle.current()
        expect(scope).not.toBeNull()
        expect(manager.current()).toBe(scope)
        adapter.write(scope!.handle, 'fixture')

        await runAfterEach()

        expect(scope!.status).toBe(TransactionStatus.ROLLED_BACK)
        expect(handle.current()).toBeNull()
        expect(manager.current()).toBeNull()
        expect(adapter.store).toEqual([])
    })

    it('starts a fresh transaction for every test', async () => {
        const { hooks, runBeforeEach, runAfterEach } = createFakeHooks()
        const handle = useTransactionalTests(hooks, { manager })

        await runBeforeEach()
        const first = handle.current()
        await runAfterEach()

        await runBeforeEach()
        const second = handle.current()
        await runAfterEach()

        expect(first).not.toBe(second)
        expect(adapter.handles).toHaveLength(2)
        expect(adapter.store).toEqual([])
    })

    it('rolls back nested transactions the test left open', async () => {
        const { hooks, runBeforeEach, runAfterEach } = createFakeHooks()
        const handle = useTransactionalTests(hooks, { manager })

        await runBeforeEach()
        const suiteScope = handle.current()!
        const nested = await manager.start()
        adapter.write(nested.handle, 'leaked')

        await runAfterEach()

        expect(nested.status).toBe(TransactionStatus.ROLLED_BACK)
        expect(suiteScope.status).toBe(TransactionStatus.ROLLED_BACK)
        expect(manager.current()).toBeNull()
        expect(adapter.store).toEqual([])
    })

    it('keeps work committed inside the test out of the shared store', async () => {
        const { hooks, runBeforeEach, runAfterEach } = createFakeHooks()
        useTransactionalTests(hooks, { manager })

        await runBeforeEach()
        await manager.run((tx) => adapter.write(tx.handle, 'inner-commit'))
        await runAfterEach()

        expect(adapter.store).toEqual([])
    })

    it('does nothing on afterEach when no transaction was started', async () => {
        const { hooks, runAfterEach } = createFakeHooks()
        useTransactionalTests(hooks, { manager })

        await runAfterEach()

        expect(adapter.log).toEqual([])
    })

    it('resolves the manager when the suite runs', async () => {
        const { hooks, runBeforeEach, runAfterEach } = createFakeHooks()
        const handle = useTransactionalTests(hooks)
        const lateAdapter = new MockTransactionAdapter()
        const lateManager = new TransactionManager(lateAdapter)

        // Registered after the suite was declared, the way a global test setup would.
        const { setDefaultTransactionManager } = await import('./transaction-session')
        setDefaultTransactionManager(lateManager)

        await runBeforeEach()
        expect(handle.current()?.adapter).toBe(lateAdapter)
        await runAfterEach()

        expect(lateAdapter.log).toEqual(['begin:1', 'rollback:1'])
    })
})

describe('useTransactionalTests with real test hooks', () => {
    const suiteAdapter = new MockTransactionAdapter()
    const suiteManager = new TransactionManager(suiteAdapter, { onError: () => {} })

    useTransactionalTests({ beforeEach, afterEach }, { manager: suiteManager })

    it('sees its own writes while the test runs', () => {
        const scope = suiteManager.current()
        expect(scope).not.toBeNull()
        suiteAdapter.write(scope!.handle, 'first-test')

        expect(scope!.handle.pending).toEqual(['first-test'])
    })

    it('does not see writes from the previous test', () => {
        const scope = suiteManager.current()

        expect(suiteAdapter.store).toEqual([])
        expect(scope!.handle.pending).toEqual([])
    })

    it('supports nested transactions inside a test', async () => {
        await transaction(
            (tx) => {
                suiteAdapter.write(tx.handle, 'nested')
            },
            { manager: suiteManager },
        )

        expect(suiteAdapter.store).toEqual([])
    })
})
