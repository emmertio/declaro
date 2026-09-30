import { Context, withContext } from '@declaro/core'
import { beforeEach, describe, expect, it } from 'bun:test'
import { TransactionStatus, type ITransaction } from '../../domain/transaction/transaction-interface'
import { useTransaction } from '../../shared/utils/transaction/use-transaction'
import { MockTransactionAdapter } from '../../test/mock/transaction/mock-transaction-adapter'
import type { ITransactionScope } from '../../types/transaction-context'
import { Transaction } from './transaction'
import { TransactionStack } from './transaction-stack'

describe('Transaction.afterCommit', () => {
    let adapter: MockTransactionAdapter
    let context: Context<ITransactionScope>
    let log: string[]

    /** The adapter log as `operation#id@depth`. */
    const operations = () =>
        adapter.operations.map(({ operation, transactionId, depth }) => `${operation}#${transactionId}@${depth}`)
    const inContext = <T>(fn: () => T) => withContext(context, fn)
    /** Returns a callback that records `name` in `log`. */
    const record = (name: string) => () => {
        log.push(name)
    }

    beforeEach(() => {
        adapter = new MockTransactionAdapter()
        context = new Context<ITransactionScope>()
        context.registerValue('transactionAdapter', adapter)
        context.registerValue('transactionStack', new TransactionStack())
        log = []
    })

    it('runs callbacks after the top-level commit, in registration order, each awaited', async () => {
        await inContext(async () => {
            const transaction = await Transaction.begin()
            transaction.afterCommit(async () => {
                await new Promise((resolve) => setTimeout(resolve, 5))
                log.push(`first (${adapter.operations.length} operations)`)
            })
            transaction.afterCommit(record('second'))

            expect(log).toEqual([])
            await transaction.commit()
        })

        expect(log).toEqual(['first (2 operations)', 'second'])
        expect(operations()).toEqual(['begin#1@0', 'commit#1@0'])
    })

    it('moves nested callbacks to the parent, running them only at the top-level commit', async () => {
        await inContext(async () => {
            const outer = await Transaction.begin()
            outer.afterCommit(record('outer 1'))

            const inner = await Transaction.begin()
            inner.afterCommit(record('inner 1'))
            inner.afterCommit(record('inner 2'))
            await inner.commit()

            expect(log).toEqual([])
            outer.afterCommit(record('outer 2'))

            await outer.commit()
        })

        expect(log).toEqual(['outer 1', 'inner 1', 'inner 2', 'outer 2'])
    })

    it('moves callbacks up through nested runs', async () => {
        await inContext(() =>
            Transaction.run(async (outer) => {
                await outer.run(async (inner) => {
                    await inner.run(async (innermost) => {
                        innermost.afterCommit(record('innermost'))
                    })
                    inner.afterCommit(record('inner'))
                })
                expect(log).toEqual([])
            }),
        )

        expect(log).toEqual(['innermost', 'inner'])
    })

    it('drops callbacks on a direct rollback', async () => {
        await inContext(async () => {
            const outer = await Transaction.begin()
            outer.afterCommit(record('outer'))

            const inner = await Transaction.begin()
            inner.afterCommit(record('inner'))
            await inner.rollback()

            await outer.commit()
        })

        expect(log).toEqual(['outer'])
    })

    it('drops callbacks on a cascaded rollback', async () => {
        await inContext(async () => {
            const outer = await Transaction.begin()
            outer.afterCommit(record('outer'))
            const inner = await Transaction.begin()
            inner.afterCommit(record('inner'))
            const committedInner = await Transaction.begin()
            committedInner.afterCommit(record('committed inner'))
            await committedInner.commit()

            await outer.rollback()
            expect(inner.status).toBe(TransactionStatus.RolledBack)
        })

        expect(log).toEqual([])
    })

    it('drops the callbacks of a nested run that rolls back', async () => {
        await inContext(() =>
            Transaction.run(async (outer) => {
                outer.afterCommit(record('outer'))
                await expect(
                    outer.run(async (inner) => {
                        inner.afterCommit(record('inner'))
                        throw new Error('nested failure')
                    }),
                ).rejects.toThrow('nested failure')
            }),
        )

        expect(log).toEqual(['outer'])
    })

    it('moves callbacks of transactions committed by a cascade', async () => {
        await inContext(async () => {
            const outer = await Transaction.begin()
            outer.afterCommit(record('outer'))
            const middle = await Transaction.begin()
            middle.afterCommit(record('middle'))
            const inner = await Transaction.begin()
            inner.afterCommit(record('inner'))

            await outer.commit()
            expect(inner.status).toBe(TransactionStatus.Committed)
            expect(middle.status).toBe(TransactionStatus.Committed)
        })

        // Each commit appends its callbacks to its parent's: inner → middle, then middle → outer.
        expect(log).toEqual(['outer', 'middle', 'inner'])
    })

    it('stops at the first failing callback, stays committed, and rejects with its error', async () => {
        await inContext(async () => {
            const transaction = await Transaction.begin()
            transaction.afterCommit(record('first'))
            transaction.afterCommit(() => {
                throw new Error('callback failure')
            })
            transaction.afterCommit(record('third'))

            await expect(transaction.commit()).rejects.toThrow('callback failure')
            expect(transaction.status).toBe(TransactionStatus.Committed)
            expect(useTransactionOrUndefined()).toBeUndefined()
        })

        expect(log).toEqual(['first'])
        expect(operations()).toEqual(['begin#1@0', 'commit#1@0'])
    })

    it('rethrows a failing callback from Transaction.run without rolling back', async () => {
        let run: ITransaction | undefined

        await expect(
            inContext(() =>
                Transaction.run(async (transaction) => {
                    run = transaction
                    transaction.afterCommit(async () => {
                        throw new Error('callback failure')
                    })
                    transaction.afterCommit(record('skipped'))
                }),
            ),
        ).rejects.toThrow('callback failure')

        expect(run?.status).toBe(TransactionStatus.Committed)
        expect(log).toEqual([])
        expect(operations()).toEqual(['begin#1@0', 'commit#1@0'])
    })

    it('runs callbacks outside the committed transaction', async () => {
        const seen: (ITransaction | undefined)[] = []
        let committed: ITransaction | undefined

        await inContext(async () => {
            const transaction = await Transaction.begin()
            committed = transaction
            transaction.afterCommit(() => {
                seen.push(useTransactionOrUndefined())
            })
            await transaction.commit()
        })

        await inContext(() =>
            Transaction.run(async (transaction) => {
                committed = transaction
                transaction.afterCommit(() => {
                    seen.push(useTransactionOrUndefined())
                })
            }),
        )

        expect(seen).toHaveLength(2)
        expect(seen).not.toContain(committed)
        expect(seen).toEqual([undefined, undefined])
    })

    it('throws when the transaction is not active', async () => {
        await inContext(async () => {
            const pending = new Transaction()
            expect(() => pending.afterCommit(record('pending'))).toThrow(
                'Cannot register an afterCommit callback on a transaction that is pending',
            )

            const committed = await Transaction.begin()
            await committed.commit()
            expect(() => committed.afterCommit(record('committed'))).toThrow(
                'Cannot register an afterCommit callback on a transaction that is committed',
            )

            const rolledBack = await Transaction.begin()
            await rolledBack.rollback()
            expect(() => rolledBack.afterCommit(record('rolled back'))).toThrow(
                'Cannot register an afterCommit callback on a transaction that is rolled-back',
            )
        })

        expect(log).toEqual([])
    })
})

/**
 * The current transaction, or `undefined` when `useTransaction()` throws.
 */
function useTransactionOrUndefined(): ITransaction | undefined {
    try {
        return useTransaction()
    } catch {
        return undefined
    }
}
