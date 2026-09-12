import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { MockTransactionAdapter } from './test/mock-transaction-adapter'
import {
    configureTransactions,
    createTransactionManager,
    transaction,
    useTransaction,
    useTransactionHandle,
} from './transaction'
import { TransactionPropagation } from './transaction-adapter'
import { NoActiveTransactionError } from './transaction-errors'
import { TransactionManager } from './transaction-manager'
import { TransactionStatus } from './transaction-scope'
import { getDefaultTransactionManager, resetTransactionState } from './transaction-session'

describe('transaction', () => {
    let adapter: MockTransactionAdapter
    let manager: TransactionManager<any>

    beforeEach(() => {
        resetTransactionState()
        adapter = new MockTransactionAdapter()
        manager = configureTransactions(adapter, { onError: () => {} })
    })

    describe('configuration', () => {
        it('registers the manager it creates as the default', () => {
            expect(getDefaultTransactionManager()).toBe(manager)
        })

        it('creates a manager without registering it', () => {
            resetTransactionState()
            const standalone = createTransactionManager(new MockTransactionAdapter())

            expect(standalone).toBeInstanceOf(TransactionManager)
            expect(getDefaultTransactionManager()).toBeNull()
        })

        it('throws when no manager can be resolved', async () => {
            resetTransactionState()

            await expect(transaction(() => undefined)).rejects.toBeInstanceOf(NoActiveTransactionError)
            expect(useTransaction()).toBeNull()
        })
    })

    describe('functional API', () => {
        it('commits through the default manager', async () => {
            const result = await transaction(async (tx) => {
                adapter.write(tx.handle, 'ambient')
                return 42
            })

            expect(result).toBe(42)
            expect(adapter.store).toEqual(['ambient'])
        })

        it('rolls back when the callback throws', async () => {
            await expect(
                transaction((tx) => {
                    adapter.write(tx.handle, 'ambient')
                    throw new Error('nope')
                }),
            ).rejects.toThrow('nope')

            expect(adapter.store).toEqual([])
        })

        it('resolves the handle of the active transaction', async () => {
            await transaction(async (tx) => {
                expect(useTransaction()).toBe(tx)
                expect(useTransactionHandle()).toBe(tx.handle)
                expect(transaction.isActive()).toBe(true)
            })

            expect(transaction.isActive()).toBe(false)
            expect(() => useTransactionHandle()).toThrow(NoActiveTransactionError)
        })

        it('runs against an explicitly provided manager', async () => {
            const otherAdapter = new MockTransactionAdapter({ name: 'other' })
            const otherManager = createTransactionManager(otherAdapter)

            await transaction((tx) => otherAdapter.write(tx.handle, 'other'), { manager: otherManager })

            expect(otherAdapter.store).toEqual(['other'])
            expect(adapter.store).toEqual([])
        })

        it('nests through the ambient API', async () => {
            await transaction(async (outer) => {
                adapter.write(outer.handle, 'outer')

                await transaction(async (inner) => {
                    adapter.write(inner.handle, 'inner')
                    expect(inner.depth).toBe(1)
                }).catch(() => undefined)

                await transaction(
                    async () => {
                        throw new Error('discarded')
                    },
                    { propagation: TransactionPropagation.NESTED },
                ).catch(() => undefined)
            })

            expect(adapter.store).toEqual(['outer', 'inner'])
        })
    })

    describe('manual API', () => {
        it('commits a manually started transaction', async () => {
            const scope = await transaction.start()
            adapter.write(scope.handle, 'manual')
            expect(transaction.current()).toBe(scope)

            await transaction.commit()

            expect(adapter.store).toEqual(['manual'])
            expect(transaction.current()).toBeNull()
        })

        it('rolls back a manually started transaction', async () => {
            const scope = await transaction.start()
            adapter.write(scope.handle, 'manual')

            await transaction.rollback()

            expect(scope.status).toBe(TransactionStatus.ROLLED_BACK)
            expect(adapter.store).toEqual([])
        })

        it('resolves the transaction started in an earlier async task', async () => {
            await transaction.start()

            await (async () => {
                const scope = transaction.current()
                expect(scope).not.toBeNull()
                adapter.write(scope!.handle, 'later')
            })()

            await transaction.commit()

            expect(adapter.store).toEqual(['later'])
        })

        it('throws when committing without an active transaction', async () => {
            await expect(transaction.commit()).rejects.toBeInstanceOf(NoActiveTransactionError)
        })

        it('marks the active transaction rollback-only', async () => {
            await transaction.start()
            transaction.setRollbackOnly()

            await expect(transaction.commit()).rejects.toThrow('rollback-only')
            expect(adapter.store).toEqual([])
        })

        it('throws when marking rollback-only without an active transaction', () => {
            expect(() => transaction.setRollbackOnly()).toThrow(NoActiveTransactionError)
        })
    })

    describe('lifecycle hooks', () => {
        it('runs commit hooks after the transaction commits', async () => {
            const order: string[] = []

            await transaction(async (tx) => {
                transaction.onCommit(() => {
                    order.push(`hook:${adapter.store.join(',')}`)
                })
                adapter.write(tx.handle, 'order')
                order.push('callback')
            })

            expect(order).toEqual(['callback', 'hook:order'])
        })

        it('skips commit hooks and runs rollback hooks when the transaction fails', async () => {
            const onCommit = mock(() => {})
            const onRollback = mock((_error?: unknown) => {})
            const onComplete = mock((_status: TransactionStatus) => {})

            await transaction(async () => {
                transaction.onCommit(onCommit)
                transaction.onRollback(onRollback)
                transaction.onComplete(onComplete)
                throw new Error('failed')
            }).catch(() => undefined)

            expect(onCommit).not.toHaveBeenCalled()
            expect(onRollback).toHaveBeenCalledTimes(1)
            expect((onRollback.mock.calls[0]?.[0] as Error).message).toBe('failed')
            expect(onComplete).toHaveBeenCalledWith(TransactionStatus.ROLLED_BACK)
        })

        it('defers hooks registered in a nested transaction until the outermost commit', async () => {
            const order: string[] = []

            await transaction(async () => {
                await transaction(async () => {
                    transaction.onCommit(() => {
                        order.push('inner-hook')
                    })
                })

                order.push('after-inner')
            })

            expect(order).toEqual(['after-inner', 'inner-hook'])
        })

        it('discards hooks from a nested transaction that rolled back', async () => {
            const innerHook = mock(() => {})
            const outerHook = mock(() => {})

            await transaction(async () => {
                transaction.onCommit(outerHook)

                await transaction(async () => {
                    transaction.onCommit(innerHook)
                    throw new Error('inner failed')
                }).catch(() => undefined)
            })

            expect(innerHook).not.toHaveBeenCalled()
            expect(outerHook).toHaveBeenCalledTimes(1)
        })

        it('never breaks a committed transaction when a hook throws', async () => {
            const onError = mock((_error: unknown, _info: any) => {})
            const reportingManager = createTransactionManager(adapter, { onError })

            const result = await transaction(
                async (tx) => {
                    tx.onCommit(() => {
                        throw new Error('reporting is down')
                    })
                    adapter.write(tx.handle, 'order')
                    return 'ok'
                },
                { manager: reportingManager },
            )

            expect(result).toBe('ok')
            expect(adapter.store).toEqual(['order'])
            expect(onError).toHaveBeenCalledTimes(1)
            expect((onError.mock.calls[0]?.[1] as any).phase).toBe('commit-hook')
        })

        it('throws when registering a hook without an active transaction', () => {
            expect(() => transaction.onCommit(() => {})).toThrow(NoActiveTransactionError)
            expect(() => transaction.onRollback(() => {})).toThrow(NoActiveTransactionError)
            expect(() => transaction.onComplete(() => {})).toThrow(NoActiveTransactionError)
        })
    })
})
