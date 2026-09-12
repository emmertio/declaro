import { describe, expect, it, mock } from 'bun:test'
import { MockTransactionAdapter, type MockTransactionHandle } from './test/mock-transaction-adapter'
import { TransactionKind, TransactionScope, TransactionStatus } from './transaction-scope'

function createScope(
    options: {
        kind?: TransactionKind
        parent?: TransactionScope<MockTransactionHandle> | null
        onHookError?: (error: unknown, info: any) => void
    } = {},
) {
    const adapter = new MockTransactionAdapter()
    const parent = options.parent ?? null

    return new TransactionScope<MockTransactionHandle>({
        adapter,
        handle: parent?.handle ?? adapter.begin(),
        kind: options.kind ?? (parent ? TransactionKind.SAVEPOINT : TransactionKind.ROOT),
        parent,
        savepointName: parent ? 'sp_1' : null,
        onHookError: options.onHookError,
    })
}

describe('TransactionScope', () => {
    it('starts active with a unique id', () => {
        const first = createScope()
        const second = createScope()

        expect(first.status).toBe(TransactionStatus.ACTIVE)
        expect(first.isActive).toBe(true)
        expect(first.isRollbackOnly).toBe(false)
        expect(first.id).not.toBe(second.id)
    })

    it('reports its position in the nesting chain', () => {
        const root = createScope()
        const child = createScope({ parent: root })
        const grandchild = createScope({ parent: child })

        expect(root.depth).toBe(0)
        expect(child.depth).toBe(1)
        expect(grandchild.depth).toBe(2)
        expect(grandchild.root).toBe(root)
        expect(root.isRoot).toBe(true)
        expect(child.isRoot).toBe(false)
    })

    it('propagates rollback-only from a joined scope to the transaction it shares', () => {
        const root = createScope()
        const joined = createScope({ parent: root, kind: TransactionKind.JOINED })

        joined.setRollbackOnly()

        expect(joined.isRollbackOnly).toBe(true)
        expect(root.isRollbackOnly).toBe(true)
    })

    it('keeps rollback-only local to a savepoint backed scope', () => {
        const root = createScope()
        const savepoint = createScope({ parent: root, kind: TransactionKind.SAVEPOINT })

        savepoint.setRollbackOnly()

        expect(savepoint.isRollbackOnly).toBe(true)
        expect(root.isRollbackOnly).toBe(false)
    })

    it('runs commit and complete hooks when a root scope commits', async () => {
        const scope = createScope()
        const calls: string[] = []
        scope.onCommit(() => {
            calls.push('commit')
        })
        scope.onRollback(() => {
            calls.push('rollback')
        })
        scope.onComplete((status) => {
            calls.push(`complete:${status}`)
        })

        await scope.settle(TransactionStatus.COMMITTED)

        expect(calls).toEqual(['commit', `complete:${TransactionStatus.COMMITTED}`])
        expect(scope.status).toBe(TransactionStatus.COMMITTED)
    })

    it('runs rollback and complete hooks when a scope rolls back', async () => {
        const scope = createScope()
        const error = new Error('failed')
        const rollbackHook = mock((_error?: unknown) => {})
        const commitHook = mock(() => {})
        scope.onCommit(commitHook)
        scope.onRollback(rollbackHook)

        await scope.settle(TransactionStatus.ROLLED_BACK, error)

        expect(commitHook).not.toHaveBeenCalled()
        expect(rollbackHook).toHaveBeenCalledWith(error)
    })

    it('forwards hooks to the parent when a nested scope commits', async () => {
        const root = createScope()
        const child = createScope({ parent: root })
        const commitHook = mock(() => {})
        child.onCommit(commitHook)

        await child.settle(TransactionStatus.COMMITTED)
        expect(commitHook).not.toHaveBeenCalled()

        await root.settle(TransactionStatus.COMMITTED)
        expect(commitHook).toHaveBeenCalledTimes(1)
    })

    it('runs every hook even when one of them throws', async () => {
        const onHookError = mock((_error: unknown, _info: any) => {})
        const scope = createScope({ onHookError })
        const secondHook = mock(() => {})
        scope.onCommit(() => {
            throw new Error('hook failed')
        })
        scope.onCommit(secondHook)

        await scope.settle(TransactionStatus.COMMITTED)

        expect(secondHook).toHaveBeenCalledTimes(1)
        expect(onHookError).toHaveBeenCalledTimes(1)
        expect((onHookError.mock.calls[0]?.[1] as any).phase).toBe('commit')
        expect((onHookError.mock.calls[0]?.[1] as any).scope).toBe(scope)
    })

    it('logs hook failures when no error handler was provided', async () => {
        const scope = createScope()
        const original = console.error
        const logged = mock((..._args: any[]) => {})
        console.error = logged as any

        try {
            scope.onRollback(() => {
                throw new Error('hook failed')
            })
            await scope.settle(TransactionStatus.ROLLED_BACK)
        } finally {
            console.error = original
        }

        expect(logged).toHaveBeenCalledTimes(1)
    })

    it('clears its hooks once it has settled', async () => {
        const scope = createScope()
        const hook = mock(() => {})
        scope.onCommit(hook)

        await scope.settle(TransactionStatus.COMMITTED)
        await scope.settle(TransactionStatus.COMMITTED)

        expect(hook).toHaveBeenCalledTimes(1)
    })

    it('treats a failed commit like a rollback for hook purposes', async () => {
        const scope = createScope()
        const commitHook = mock(() => {})
        const rollbackHook = mock(() => {})
        scope.onCommit(commitHook)
        scope.onRollback(rollbackHook)

        await scope.settle(TransactionStatus.FAILED, new Error('commit failed'))

        expect(commitHook).not.toHaveBeenCalled()
        expect(rollbackHook).toHaveBeenCalledTimes(1)
        expect(scope.isActive).toBe(false)
    })
})
