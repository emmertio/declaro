import { beforeEach, describe, expect, it } from 'bun:test'
import { TransactionStatus } from '../../domain/transaction/transaction-adapter-interface'
import { useTransaction } from '../../shared/utils/transaction/use-transaction'
import { MockTransactionAdapter } from '../../test/mock/transaction/mock-transaction-adapter'
import { NoopTransactionAdapter } from './noop-transaction-adapter'

describe('TransactionAdapter', () => {
    let transaction: MockTransactionAdapter

    const operationsOf = (transaction: MockTransactionAdapter) =>
        transaction.operations.map(({ operation, depth }) => `${operation}@${depth}`)

    beforeEach(() => {
        transaction = new MockTransactionAdapter()
    })

    describe('manual lifecycle', () => {
        it('starts pending at depth 0', () => {
            expect(transaction.status).toBe(TransactionStatus.Pending)
            expect(transaction.depth).toBe(0)
            expect(transaction.parent).toBeUndefined()
        })

        it('moves through begin and commit', async () => {
            await transaction.begin()
            expect(transaction.status).toBe(TransactionStatus.Active)

            await transaction.commit()
            expect(transaction.status).toBe(TransactionStatus.Committed)
            expect(operationsOf(transaction)).toEqual(['begin@0', 'commit@0'])
        })

        it('moves through begin and rollback', async () => {
            await transaction.begin()
            await transaction.rollback()

            expect(transaction.status).toBe(TransactionStatus.RolledBack)
            expect(operationsOf(transaction)).toEqual(['begin@0', 'rollback@0'])
        })

        it('rejects invalid transitions', async () => {
            await expect(transaction.commit()).rejects.toThrow('Cannot commit a transaction that is pending')
            await expect(transaction.rollback()).rejects.toThrow('Cannot rollback a transaction that is pending')
            expect(() => transaction.nested()).toThrow('Cannot nest a transaction in a transaction that is pending')

            await transaction.begin()
            await expect(transaction.begin()).rejects.toThrow('Cannot begin a transaction that is active')

            await transaction.commit()
            await expect(transaction.rollback()).rejects.toThrow('Cannot rollback a transaction that is committed')
        })

        it('keeps its status when a hook fails', async () => {
            await transaction.begin()
            transaction.failures.commit = true

            await expect(transaction.commit()).rejects.toThrow('Mock commit failure')
            expect(transaction.status).toBe(TransactionStatus.Active)

            await transaction.rollback()
            expect(transaction.status).toBe(TransactionStatus.RolledBack)
        })

        it('creates nested transactions that point at their parent', async () => {
            await transaction.begin()
            const nested = transaction.nested()
            await nested.begin()
            await nested.rollback()
            await transaction.commit()

            expect(nested.parent).toBe(transaction)
            expect(nested.depth).toBe(1)
            expect(operationsOf(transaction)).toEqual(['begin@0', 'begin@1', 'rollback@1', 'commit@0'])
        })
    })

    describe('run', () => {
        it('commits and returns the result when the callback succeeds', async () => {
            const result = await transaction.run(async () => 'done')

            expect(result).toBe('done')
            expect(transaction.status).toBe(TransactionStatus.Committed)
            expect(operationsOf(transaction)).toEqual(['begin@0', 'commit@0'])
        })

        it('rolls back and rethrows when the callback throws', async () => {
            await expect(
                transaction.run(async () => {
                    throw new Error('boom')
                }),
            ).rejects.toThrow('boom')

            expect(transaction.status).toBe(TransactionStatus.RolledBack)
            expect(operationsOf(transaction)).toEqual(['begin@0', 'rollback@0'])
        })

        it('passes the transaction to the callback and binds it to the ambient context', async () => {
            await transaction.run(async (tx) => {
                expect(tx).toBe(transaction)
                expect(await useTransaction()).toBe(transaction)
            })
        })

        it('rolls back when commit fails', async () => {
            transaction.failures.commit = true

            await expect(transaction.run(async () => {})).rejects.toThrow('Mock commit failure')
            expect(transaction.status).toBe(TransactionStatus.RolledBack)
        })

        it('reports both errors when the rollback fails too', async () => {
            transaction.failures.rollback = true
            const error = new Error('boom')

            const failure = await transaction
                .run(async () => {
                    throw error
                })
                .catch((failure) => failure)

            expect(failure).toBeInstanceOf(AggregateError)
            expect(failure.errors[0]).toBe(error)
            expect(failure.errors[1].message).toBe('Mock rollback failure')
        })

        it('does not commit or roll back a transaction the callback already finished', async () => {
            await transaction.run(async (tx) => {
                await tx.rollback()
            })

            expect(transaction.status).toBe(TransactionStatus.RolledBack)
            expect(operationsOf(transaction)).toEqual(['begin@0', 'rollback@0'])
        })

        it('runs in a nested transaction when the transaction is already active', async () => {
            await transaction.begin()

            await transaction.run(async (nested) => {
                expect(nested).not.toBe(transaction)
                expect(nested.parent).toBe(transaction)
                expect(await useTransaction()).toBe(nested)
            })

            expect(transaction.status).toBe(TransactionStatus.Active)
            expect(operationsOf(transaction)).toEqual(['begin@0', 'begin@1', 'commit@1'])
        })

        it('rolls back only the nested transaction when its error is caught', async () => {
            await transaction.run(async (outer) => {
                await outer
                    .run(async () => {
                        throw new Error('nested failure')
                    })
                    .catch(() => {})
            })

            expect(transaction.status).toBe(TransactionStatus.Committed)
            expect(operationsOf(transaction)).toEqual(['begin@0', 'begin@1', 'rollback@1', 'commit@0'])
        })

        it('rolls back every level when a nested error escapes', async () => {
            await expect(
                transaction.run(async (outer) => {
                    await outer.run(async (middle) => {
                        await middle.run(async () => {
                            throw new Error('deep failure')
                        })
                    })
                }),
            ).rejects.toThrow('deep failure')

            expect(operationsOf(transaction)).toEqual([
                'begin@0',
                'begin@1',
                'begin@2',
                'rollback@2',
                'rollback@1',
                'rollback@0',
            ])
        })

        it('refuses to run a finished transaction', async () => {
            await transaction.run(async () => {})

            await expect(transaction.run(async () => {})).rejects.toThrow(
                'Cannot run a transaction that has already been committed',
            )
        })
    })
})

describe('NoopTransactionAdapter', () => {
    it('tracks status and nests without doing anything', async () => {
        const transaction = new NoopTransactionAdapter()

        await transaction.run(async (outer) => {
            await outer.run(async (nested) => {
                expect(nested).toBeInstanceOf(NoopTransactionAdapter)
                expect(nested.depth).toBe(1)
            })
        })

        expect(transaction.status).toBe(TransactionStatus.Committed)
    })
})
