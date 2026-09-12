import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { MockTransactionAdapter } from './test/mock-transaction-adapter'
import { TransactionPropagation } from './transaction-adapter'
import { InactiveTransactionError, TransactionRollbackError } from './transaction-errors'
import { TransactionManager } from './transaction-manager'
import { TransactionKind, TransactionStatus } from './transaction-scope'
import { resetTransactionState } from './transaction-session'

describe('TransactionManager', () => {
    let adapter: MockTransactionAdapter
    let manager: TransactionManager<any>

    beforeEach(() => {
        resetTransactionState()
        adapter = new MockTransactionAdapter()
        manager = new TransactionManager(adapter, { onError: () => {} })
    })

    describe('functional API', () => {
        it('commits when the callback resolves', async () => {
            const result = await manager.run((tx) => {
                adapter.write(tx.handle, 'order')
                return 'done'
            })

            expect(result).toBe('done')
            expect(adapter.store).toEqual(['order'])
            expect(adapter.log).toEqual(['begin:1', 'write:1:order', 'commit:1'])
        })

        it('rolls back and rethrows when the callback throws', async () => {
            const failure = new Error('boom')

            const promise = manager.run((tx) => {
                adapter.write(tx.handle, 'order')
                throw failure
            })

            await expect(promise).rejects.toThrow(failure)
            expect(adapter.store).toEqual([])
            expect(adapter.log).toEqual(['begin:1', 'write:1:order', 'rollback:1'])
        })

        it('leaves no open handles behind', async () => {
            await manager.run(() => undefined)
            await manager.run(() => Promise.reject(new Error('nope'))).catch(() => undefined)

            expect(adapter.openHandles).toEqual([])
        })

        it('exposes the active transaction while the callback runs', async () => {
            expect(manager.current()).toBeNull()

            await manager.run(async (tx) => {
                expect(manager.current()).toBe(tx)
                expect(manager.isActive()).toBe(true)
                expect(tx.kind).toBe(TransactionKind.ROOT)
                expect(tx.depth).toBe(0)
                expect(tx.isRoot).toBe(true)
                await Promise.resolve()
                expect(manager.current()).toBe(tx)
            })

            expect(manager.current()).toBeNull()
            expect(manager.isActive()).toBe(false)
        })

        it('forwards isolation options to the adapter', async () => {
            await manager.run(() => undefined, { isReadOnly: true, meta: { source: 'report' } })

            expect(adapter.handles[0]?.options).toMatchObject({
                isReadOnly: true,
                meta: { source: 'report' },
            })
        })

        it('uses the adapter run hook to bind the handle around the callback', async () => {
            const boundAdapter = new MockTransactionAdapter({ hasRunHook: true })
            const boundManager = new TransactionManager(boundAdapter)

            await boundManager.run((tx) => {
                expect(boundAdapter.boundHandle).toBe(tx.handle)
            })

            expect(boundAdapter.boundHandle).toBeNull()
            expect(boundAdapter.log).toEqual(['begin:1', 'run:1', 'commit:1'])
        })

        it('keeps concurrent transactions isolated', async () => {
            const [first, second] = await Promise.all([
                manager.run(async (tx) => {
                    await Promise.resolve()
                    adapter.write(tx.handle, 'first')
                    await Promise.resolve()
                    expect(manager.current()).toBe(tx)
                    return tx.handle.id
                }),
                manager.run(async (tx) => {
                    adapter.write(tx.handle, 'second')
                    await Promise.resolve()
                    expect(manager.current()).toBe(tx)
                    return tx.handle.id
                }),
            ])

            expect(first).not.toBe(second)
            expect(adapter.store.sort()).toEqual(['first', 'second'])
        })

        it('does not leak the transaction into unrelated async branches', async () => {
            await manager.run(async () => {
                await Promise.resolve()
            })

            expect(manager.current()).toBeNull()
        })
    })

    describe('nested transactions', () => {
        it('nests with a savepoint by default and keeps outer work when the inner rolls back', async () => {
            await manager.run(async (outer) => {
                adapter.write(outer.handle, 'outer')

                await manager
                    .run(async (inner) => {
                        expect(inner.kind).toBe(TransactionKind.SAVEPOINT)
                        expect(inner.depth).toBe(1)
                        expect(inner.root).toBe(outer)
                        expect(inner.handle).toBe(outer.handle)
                        adapter.write(inner.handle, 'inner')
                        throw new Error('inner failed')
                    })
                    .catch(() => undefined)
            })

            expect(adapter.store).toEqual(['outer'])
            expect(adapter.log).toEqual([
                'begin:1',
                'write:1:outer',
                'savepoint:declaro_sp_1',
                'write:1:inner',
                'rollback-to:declaro_sp_1',
                'commit:1',
            ])
        })

        it('releases the savepoint and keeps inner work when the inner commits', async () => {
            await manager.run(async (outer) => {
                adapter.write(outer.handle, 'outer')
                await manager.run((inner) => adapter.write(inner.handle, 'inner'))
            })

            expect(adapter.store).toEqual(['outer', 'inner'])
            expect(adapter.handles).toHaveLength(1)
        })

        it('rolls the whole transaction back when an outer transaction fails', async () => {
            const promise = manager.run(async (outer) => {
                adapter.write(outer.handle, 'outer')
                await manager.run((inner) => adapter.write(inner.handle, 'inner'))
                throw new Error('outer failed')
            })

            await expect(promise).rejects.toThrow('outer failed')
            expect(adapter.store).toEqual([])
        })

        it('joins the outer transaction when the adapter has no savepoints', async () => {
            const plainAdapter = new MockTransactionAdapter({ hasSavepoints: false })
            const plainManager = new TransactionManager(plainAdapter, { onError: () => {} })

            await plainManager.run(async (outer) => {
                await plainManager.run((inner) => {
                    expect(inner.kind).toBe(TransactionKind.JOINED)
                    expect(inner.handle).toBe(outer.handle)
                    plainAdapter.write(inner.handle, 'inner')
                })
            })

            expect(plainAdapter.handles).toHaveLength(1)
            expect(plainAdapter.store).toEqual(['inner'])
            expect(plainAdapter.log).toEqual(['begin:1', 'write:1:inner', 'commit:1'])
        })

        it('marks the shared transaction rollback-only when a joined transaction rolls back', async () => {
            const promise = manager.run(async (outer) => {
                adapter.write(outer.handle, 'outer')

                await manager
                    .run(
                        () => {
                            throw new Error('inner failed')
                        },
                        { propagation: TransactionPropagation.JOIN },
                    )
                    .catch(() => undefined)

                expect(outer.isRollbackOnly).toBe(true)
            })

            await expect(promise).rejects.toBeInstanceOf(TransactionRollbackError)
            expect(adapter.store).toEqual([])
            expect(adapter.log).toEqual(['begin:1', 'write:1:outer', 'rollback:1'])
        })

        it('runs an independent transaction with REQUIRES_NEW', async () => {
            const promise = manager.run(async (outer) => {
                adapter.write(outer.handle, 'outer')

                await manager.run(
                    (inner) => {
                        expect(inner.isRoot).toBe(true)
                        expect(inner.handle).not.toBe(outer.handle)
                        adapter.write(inner.handle, 'independent')
                    },
                    { propagation: TransactionPropagation.REQUIRES_NEW },
                )

                throw new Error('outer failed')
            })

            await expect(promise).rejects.toThrow('outer failed')
            expect(adapter.store).toEqual(['independent'])
            expect(adapter.handles).toHaveLength(2)
        })

        it('honors a manager level default propagation', async () => {
            const joiningManager = new TransactionManager(adapter, {
                defaultPropagation: TransactionPropagation.JOIN,
            })

            expect(joiningManager.defaultPropagation).toBe(TransactionPropagation.JOIN)

            await joiningManager.run(async () => {
                await joiningManager.run((inner) => {
                    expect(inner.kind).toBe(TransactionKind.JOINED)
                })
            })

            expect(adapter.log).toEqual(['begin:1', 'commit:1'])
        })

        it('supports transactions from different managers side by side', async () => {
            const otherAdapter = new MockTransactionAdapter({ name: 'other' })
            const otherManager = new TransactionManager(otherAdapter)

            await manager.run(async (outer) => {
                adapter.write(outer.handle, 'primary')

                await otherManager.run(async (other) => {
                    otherAdapter.write(other.handle, 'secondary')
                    expect(other.isRoot).toBe(true)
                    expect(manager.current()).toBe(outer)
                })

                await manager.run((inner) => {
                    expect(inner.kind).toBe(TransactionKind.SAVEPOINT)
                    expect(inner.root).toBe(outer)
                })
            })

            expect(adapter.store).toEqual(['primary'])
            expect(otherAdapter.store).toEqual(['secondary'])
        })
    })

    describe('failures', () => {
        it('marks the scope failed and rethrows when the adapter cannot commit', async () => {
            adapter.shouldFailCommit = true
            let scope: any

            const promise = manager.run((tx) => {
                scope = tx
            })

            await expect(promise).rejects.toThrow('commit failed')
            expect(scope.status).toBe(TransactionStatus.FAILED)
            expect(manager.current()).toBeNull()
        })

        it('reports a failing rollback without hiding the original error', async () => {
            const onError = mock((_error: unknown, _info: any) => {})
            const failingManager = new TransactionManager(adapter, { onError })
            adapter.shouldFailRollback = true

            const promise = failingManager.run(() => {
                throw new Error('original failure')
            })

            await expect(promise).rejects.toThrow('original failure')
            expect(onError).toHaveBeenCalledTimes(1)
            expect((onError.mock.calls[0]?.[1] as any).phase).toBe('rollback')
        })

        it('propagates a failure to start the transaction', async () => {
            adapter.shouldFailBegin = true

            await expect(manager.run(() => undefined)).rejects.toThrow('begin failed')
            expect(manager.current()).toBeNull()
        })

        it('accepts a callback that settles the transaction itself', async () => {
            const result = await manager.run(async (tx) => {
                adapter.write(tx.handle, 'manual-commit')
                await manager.commit()
                expect(tx.status).toBe(TransactionStatus.COMMITTED)
                return 'done'
            })

            expect(result).toBe('done')
            expect(adapter.store).toEqual(['manual-commit'])
            expect(adapter.log).toEqual(['begin:1', 'write:1:manual-commit', 'commit:1'])
        })

        it('rolls back transactions the callback started manually and left open', async () => {
            let dangling: any

            await manager.run(async () => {
                dangling = await manager.start()
                adapter.write(dangling.handle, 'dangling')
            })

            expect(dangling.status).toBe(TransactionStatus.ROLLED_BACK)
            expect(adapter.store).toEqual([])
            expect(adapter.log).toEqual([
                'begin:1',
                'savepoint:declaro_sp_1',
                'write:1:dangling',
                'rollback-to:declaro_sp_1',
                'commit:1',
            ])
        })
    })

    describe('manual API', () => {
        it('commits work started with start()', async () => {
            const scope = await manager.start()
            adapter.write(scope.handle, 'manual')
            expect(manager.current()).toBe(scope)

            await manager.commit()

            expect(scope.status).toBe(TransactionStatus.COMMITTED)
            expect(adapter.store).toEqual(['manual'])
            expect(manager.current()).toBeNull()
        })

        it('rolls back work started with start()', async () => {
            const scope = await manager.start()
            adapter.write(scope.handle, 'manual')

            await manager.rollback()

            expect(scope.status).toBe(TransactionStatus.ROLLED_BACK)
            expect(adapter.store).toEqual([])
        })

        it('nests manual transactions', async () => {
            const outer = await manager.start()
            adapter.write(outer.handle, 'outer')

            const inner = await manager.start()
            expect(inner.kind).toBe(TransactionKind.SAVEPOINT)
            adapter.write(inner.handle, 'inner')
            await manager.rollback()

            expect(manager.current()).toBe(outer)
            await manager.commit()

            expect(adapter.store).toEqual(['outer'])
        })

        it('throws when committing without an active transaction', async () => {
            await expect(manager.commit()).rejects.toThrow('no transaction is active')
        })

        it('throws when rolling back without an active transaction', async () => {
            await expect(manager.rollback()).rejects.toThrow('no transaction is active')
        })

        it('throws a rollback error when committing a rollback-only transaction', async () => {
            const scope = await manager.start()
            scope.setRollbackOnly()

            await expect(manager.commit()).rejects.toBeInstanceOf(TransactionRollbackError)
            expect(scope.status).toBe(TransactionStatus.ROLLED_BACK)
            expect(adapter.log).toEqual(['begin:1', 'rollback:1'])
        })

        it('throws when settling an already settled scope directly', async () => {
            const scope = await manager.start()
            await manager.commit()

            const session = { manager, stack: [scope] }
            await expect(manager.commitScope(session as any, scope)).rejects.toBeInstanceOf(InactiveTransactionError)
        })
    })
})
