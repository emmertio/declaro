import { Context, useContext, withContext } from '@declaro/core'
import { beforeEach, describe, expect, it } from 'bun:test'
import { TransactionStatus, type ITransaction } from '../../domain/transaction/transaction-interface'
import * as transactionExports from '../../index'
import { useTransaction } from '../../shared/utils/transaction/use-transaction'
import { useTransactionAdapter } from '../../shared/utils/transaction/use-transaction-adapter'
import { MockTransactionAdapter } from '../../test/mock/transaction/mock-transaction-adapter'
import type { ITransactionScope } from '../../types/transaction-context'
import { Transaction } from './transaction'
import { TransactionStack } from './transaction-stack'

describe('Transaction', () => {
    let adapter: MockTransactionAdapter
    let context: Context<ITransactionScope>
    let stack: TransactionStack

    /** The adapter log as `operation#id@depth`. */
    const operations = () =>
        adapter.operations.map(({ operation, transactionId, depth }) => `${operation}#${transactionId}@${depth}`)
    const inContext = <T>(fn: () => T) => withContext(context, fn)
    /** The current transaction, or `undefined` when there is none. */
    const current = () => {
        try {
            return useTransaction()
        } catch {
            return undefined
        }
    }

    beforeEach(() => {
        adapter = new MockTransactionAdapter()
        stack = new TransactionStack()
        context = new Context<ITransactionScope>()
        context.registerValue('transactionAdapter', adapter)
        context.registerValue('transactionStack', stack)
    })

    describe('the stack', () => {
        it('follows begin, commit and rollback inside a run (spec example)', async () => {
            const seen: Record<string, ITransaction | undefined> = {}
            let tx1: ITransaction | undefined
            let tx2: Transaction | undefined
            let tx3: Transaction | undefined

            await inContext(async () => {
                await Transaction.run(async (transaction) => {
                    tx1 = transaction
                    seen.start = current()

                    tx2 = await Transaction.begin()
                    seen.afterBegin2 = current()

                    tx3 = new Transaction()
                    seen.afterConstruct3 = current()

                    await tx3.begin()
                    seen.afterBegin3 = current()

                    await tx3.commit()
                    seen.afterCommit3 = current()

                    await tx2.rollback()
                    seen.afterRollback2 = current()
                })

                seen.afterRun = current()
            })

            expect(seen.start).toBe(tx1!)
            expect(seen.afterBegin2).toBe(tx2!)
            expect(seen.afterConstruct3).toBe(tx2!)
            expect(seen.afterBegin3).toBe(tx3!)
            expect(seen.afterCommit3).toBe(tx2!)
            expect(seen.afterRollback2).toBe(tx1!)
            expect(seen.afterRun).toBeUndefined()

            expect(tx2!.parent).toBe(tx1!)
            expect(tx3!.parent).toBe(tx2!)
            expect(tx1!.status).toBe(TransactionStatus.Committed)
            expect(tx2!.status).toBe(TransactionStatus.RolledBack)
            expect(tx3!.status).toBe(TransactionStatus.Committed)
            expect(operations()).toEqual([
                'begin#1@0',
                'begin#2@1',
                'begin#3@2',
                'commit#3@2',
                'rollback#2@1',
                'commit#1@0',
            ])
        })

        it('follows the same steps on a manually registered stack, without a run', async () => {
            await inContext(async () => {
                expect(current()).toBeUndefined()

                const tx1 = await Transaction.begin()
                expect(current()).toBe(tx1)

                const tx2 = await Transaction.begin()
                expect(current()).toBe(tx2)

                const tx3 = new Transaction()
                expect(current()).toBe(tx2)

                await tx3.begin()
                expect(current()).toBe(tx3)

                await tx3.commit()
                expect(current()).toBe(tx2)

                await tx2.rollback()
                expect(current()).toBe(tx1)

                await tx1.commit()
                expect(current()).toBeUndefined()
            })

            expect(stack.size).toBe(0)
            expect(operations()).toEqual([
                'begin#1@0',
                'begin#2@1',
                'begin#3@2',
                'commit#3@2',
                'rollback#2@1',
                'commit#1@0',
            ])
        })

        it('uses the stack of the context it began in, even when finished outside any context', async () => {
            const transaction = await inContext(() => Transaction.begin())

            expect(stack.current).toBe(transaction)
            await transaction.commit()
            expect(stack.current).toBeUndefined()
        })
    })

    describe('stateless mode', () => {
        it('begins, commits and rolls back with no context when given an adapter', async () => {
            const committed = await Transaction.begin({ adapter })
            expect(committed.status).toBe(TransactionStatus.Active)
            expect(current()).toBeUndefined()
            await committed.commit()

            const rolledBack = new Transaction({ adapter })
            await rolledBack.begin()
            await rolledBack.rollback()

            expect([committed.status, rolledBack.status]).toEqual([
                TransactionStatus.Committed,
                TransactionStatus.RolledBack,
            ])
            expect(operations()).toEqual(['begin#1@0', 'commit#1@0', 'begin#2@0', 'rollback#2@0'])
        })

        it('tracks nothing in a context without a stack, taking the adapter from it', async () => {
            const bare = new Context<ITransactionScope>()
            bare.registerValue('transactionAdapter', adapter)

            await withContext(bare, async () => {
                const outer = await Transaction.begin()
                expect(current()).toBeUndefined()

                const unrelated = await Transaction.begin()
                expect(unrelated.parent).toBeUndefined()
                expect(current()).toBeUndefined()

                await unrelated.commit()
                await outer.rollback()
            })

            expect(operations()).toEqual(['begin#1@0', 'begin#2@0', 'commit#2@0', 'rollback#1@0'])
        })

        it('nests only in a parent passed explicitly', async () => {
            const parent = await Transaction.begin({ adapter })
            const child = await Transaction.begin({ adapter, parent })

            expect(child.parent).toBe(parent)
            expect(child.depth).toBe(1)
            await child.commit()
            await parent.commit()

            expect(operations()).toEqual(['begin#1@0', 'begin#2@1', 'commit#2@1', 'commit#1@0'])
        })

        it('still refuses to finish a parent with an open child passed it explicitly', async () => {
            const parent = await Transaction.begin({ adapter })
            const child = await Transaction.begin({ adapter, parent })

            await expect(parent.commit()).rejects.toThrow('open child transaction(s)')
            expect(parent.status).toBe(TransactionStatus.Active)

            await child.rollback()
            await parent.commit()
            expect(operations()).toEqual(['begin#1@0', 'begin#2@1', 'rollback#2@1', 'commit#1@0'])
        })

        it('makes a run current inside its callback, in a fresh context', async () => {
            const transaction = await Transaction.begin({ adapter })

            await transaction.run(async (child) => {
                expect(useTransaction()).toBe(child)
                expect(useTransactionAdapter()).toBe(adapter)
                const grandchild = await Transaction.begin()
                expect(grandchild.parent).toBe(child)
                await grandchild.commit()
            })
            await transaction.commit()

            expect(operations()).toEqual([
                'begin#1@0',
                'begin#2@1',
                'begin#3@2',
                'commit#3@2',
                'commit#2@1',
                'commit#1@0',
            ])
        })

        it('runs afterCommit callbacks in a fresh context with no transaction', async () => {
            const seen: (ITransaction | undefined)[] = []
            const transaction = await Transaction.begin({ adapter })
            transaction.afterCommit(() => {
                seen.push(current())
                expect(useContext()).not.toBeNull()
            })

            await transaction.commit()
            expect(seen).toEqual([undefined])
        })
    })

    describe('lifecycle', () => {
        it('starts pending at depth 0 with no parent', () => {
            const transaction = new Transaction({ adapter })

            expect(transaction.status).toBe(TransactionStatus.Pending)
            expect(transaction.depth).toBe(0)
            expect(transaction.parent).toBeUndefined()
        })

        it('moves through begin and commit', async () => {
            await inContext(async () => {
                const transaction = new Transaction()
                await transaction.begin()
                expect(transaction.status).toBe(TransactionStatus.Active)

                await transaction.commit()
                expect(transaction.status).toBe(TransactionStatus.Committed)
            })

            expect(operations()).toEqual(['begin#1@0', 'commit#1@0'])
        })

        it('moves through begin and rollback', async () => {
            const transaction = await inContext(() => Transaction.begin())
            await transaction.rollback()

            expect(transaction.status).toBe(TransactionStatus.RolledBack)
            expect(operations()).toEqual(['begin#1@0', 'rollback#1@0'])
        })

        it('rejects invalid transitions', async () => {
            const transaction = new Transaction({ adapter })

            await expect(transaction.commit()).rejects.toThrow('Cannot commit a transaction that is pending')
            await expect(transaction.rollback()).rejects.toThrow('Cannot rollback a transaction that is pending')
            await expect(transaction.run(async () => {})).rejects.toThrow(
                'Cannot run a child of a transaction that is pending',
            )

            await inContext(() => transaction.begin())
            await expect(transaction.begin()).rejects.toThrow('Cannot begin a transaction that is active')

            await transaction.commit()
            await expect(transaction.rollback()).rejects.toThrow('Cannot rollback a transaction that is committed')
            await expect(transaction.run(async () => {})).rejects.toThrow(
                'Cannot run a child of a transaction that is committed',
            )
        })

        it('stays pending and off the stack when the adapter fails to begin', async () => {
            adapter.failures.begin = true
            const transaction = inContext(() => new Transaction())

            await expect(inContext(() => transaction.begin())).rejects.toThrow('Mock begin failure')
            expect(transaction.status).toBe(TransactionStatus.Pending)
            expect(stack.size).toBe(0)
        })

        it('stays active and current when the adapter fails to commit', async () => {
            const transaction = await inContext(() => Transaction.begin())
            adapter.failures.commit = true

            await expect(transaction.commit()).rejects.toThrow('Mock commit failure')
            expect(transaction.status).toBe(TransactionStatus.Active)
            expect(stack.current).toBe(transaction)

            await transaction.rollback()
            expect(transaction.status).toBe(TransactionStatus.RolledBack)
            expect(stack.size).toBe(0)
        })

        it('stays active and current when the adapter fails to roll back', async () => {
            const transaction = await inContext(() => Transaction.begin())
            adapter.failures.rollback = true

            await expect(transaction.rollback()).rejects.toThrow('Mock rollback failure')
            expect(transaction.status).toBe(TransactionStatus.Active)
            expect(stack.current).toBe(transaction)
        })

        it('rejects concurrent operations on one transaction', async () => {
            const transaction = inContext(() => new Transaction())

            const beginning = inContext(() => transaction.begin())
            await expect(inContext(() => transaction.begin())).rejects.toThrow(
                'Cannot begin a transaction while another operation on it is in progress',
            )
            await beginning

            const committing = transaction.commit()
            const rollingBack = transaction.rollback()
            await expect(transaction.commit()).rejects.toThrow(
                'Cannot commit a transaction while another operation on it is in progress',
            )
            await expect(rollingBack).rejects.toThrow(
                'Cannot rollback a transaction while another operation on it is in progress',
            )
            await committing

            expect(transaction.status).toBe(TransactionStatus.Committed)
            expect(operations()).toEqual(['begin#1@0', 'commit#1@0'])
        })

        it('rejects a rollback while a commit is in flight, even after the adapter was called', async () => {
            const transaction = await inContext(() => Transaction.begin())
            let release: (() => void) | undefined
            adapter.commit = async (tx) => {
                await new Promise<void>((resolve) => (release = resolve))
                return MockTransactionAdapter.prototype.commit.call(adapter, tx)
            }

            const committing = transaction.commit()
            // The beforeCommit event is awaited first, so wait until the adapter call is actually in flight.
            while (!release) {
                await Promise.resolve()
            }
            await expect(transaction.rollback()).rejects.toThrow('while another operation on it is in progress')
            release!()
            await committing

            expect(transaction.status).toBe(TransactionStatus.Committed)
        })
    })

    describe('construction and parents', () => {
        it('resolves the adapter in the constructor, with one error whether there is no context or no adapter', () => {
            const message =
                'No transaction adapter could be found. Run this inside withContext(...) on a context with a transaction adapter registered (transactionModule()), or pass { adapter }.'

            expect(() => new Transaction()).toThrow(message)
            expect(() => withContext(new Context(), () => new Transaction())).toThrow(message)
            expect(() => inContext(() => new Transaction())).not.toThrow()
        })

        it('throws from the statics before anything else when no adapter can be found', async () => {
            let hasRun = false

            await expect(Transaction.begin()).rejects.toThrow('No transaction adapter could be found')
            await expect(Transaction.begin({ parent: null })).rejects.toThrow('No transaction adapter could be found')
            await expect(
                Transaction.run(() => {
                    hasRun = true
                }),
            ).rejects.toThrow('No transaction adapter could be found')
            await expect(withContext(new Context(), () => Transaction.begin())).rejects.toThrow(
                'No transaction adapter could be found',
            )

            expect(hasRun).toBe(false)
            expect(adapter.operations).toEqual([])
        })

        it('uses a passed adapter as is, without looking one up on the context', async () => {
            const otherAdapter = new MockTransactionAdapter()
            const transaction = inContext(() => new Transaction({ adapter: otherAdapter }))

            await inContext(() => transaction.begin())
            await transaction.commit()

            expect(adapter.operations).toEqual([])
            expect(otherAdapter.operations.map(({ operation }) => operation)).toEqual(['begin', 'commit'])
        })

        it('lets a subclass override the adapter lookup', async () => {
            const fallback = new MockTransactionAdapter()
            class FallbackTransaction extends Transaction {
                protected override resolveAdapter() {
                    return fallback
                }
            }

            const transaction = new FallbackTransaction()
            await transaction.begin()
            await transaction.commit()

            const explicit = new FallbackTransaction({ adapter })
            await explicit.begin()
            await explicit.rollback()

            expect(fallback.operations.map(({ operation }) => operation)).toEqual(['begin', 'commit'])
            expect(operations()).toEqual(['begin#1@0', 'rollback#1@0'])
        })

        it('decides the parent at begin(), not at construction', async () => {
            await inContext(async () => {
                const outer = await Transaction.begin()
                const late = new Transaction()
                expect(late.parent).toBeUndefined()

                const other = await Transaction.begin()
                await late.begin()

                expect(late.parent).toBe(other)
                expect(late.depth).toBe(2)
                expect(other.parent).toBe(outer)

                await late.commit()
                await other.commit()
                await outer.commit()
            })
        })

        it('nests automatically only under a transaction with the same adapter', async () => {
            const otherAdapter = new MockTransactionAdapter()

            await inContext(async () => {
                const outer = await Transaction.begin()
                const sameAdapter = await Transaction.begin()
                expect(sameAdapter.parent).toBe(outer)
                await sameAdapter.commit()

                const different = await Transaction.begin({ adapter: otherAdapter })
                expect(different.parent).toBeUndefined()
                expect(different.depth).toBe(0)
                expect(current()).toBe(different)

                await different.commit()
                await outer.commit()
            })

            expect(otherAdapter.operations.map(({ depth }) => depth)).toEqual([0, 0])
        })

        it('forces a top-level transaction with parent: null', async () => {
            await inContext(async () => {
                const outer = await Transaction.begin()
                const independent = await Transaction.begin({ parent: null })

                expect(independent.parent).toBeUndefined()
                expect(current()).toBe(independent)
                await independent.commit()
                await outer.commit()
            })

            expect(operations()).toEqual(['begin#1@0', 'begin#2@0', 'commit#2@0', 'commit#1@0'])
        })

        it('nests in an explicit parent', async () => {
            const parent = await inContext(() => Transaction.begin())
            const child = await inContext(() => Transaction.begin({ parent, adapter: new MockTransactionAdapter() }))

            expect(child.parent).toBe(parent)
            expect(child.depth).toBe(1)
            await child.commit()
            await parent.commit()
        })

        it('throws when an explicit parent is not active', async () => {
            const pending = new Transaction({ adapter })
            await expect(inContext(() => Transaction.begin({ parent: pending }))).rejects.toThrow(
                'Cannot begin a transaction nested in a parent that is pending',
            )

            await inContext(() => pending.begin())
            await pending.commit()
            const child = new Transaction({ adapter, parent: pending })
            await expect(inContext(() => child.begin())).rejects.toThrow(
                'Cannot begin a transaction nested in a parent that is committed',
            )
            expect(child.status).toBe(TransactionStatus.Pending)
            expect(stack.size).toBe(0)
        })

        it('has no Transaction.create', () => {
            expect('create' in Transaction).toBe(false)
            expect(Object.keys(transactionExports)).not.toContain('create')
        })
    })

    describe('completion rules', () => {
        it('commits everything begun after it first, innermost first, children or not', async () => {
            const otherAdapter = new MockTransactionAdapter()
            const order: string[] = []
            for (const [name, tracked] of [
                ['a', adapter],
                ['b', otherAdapter],
            ] as const) {
                const commit = tracked.commit.bind(tracked)
                tracked.commit = async (transaction) => {
                    order.push(`${name}#${tracked.handle(transaction).id}`)
                    return commit(transaction)
                }
            }

            await inContext(async () => {
                const tx1 = await Transaction.begin()
                const tx2 = await Transaction.begin()
                const independent = await Transaction.begin({ parent: null })
                const different = await Transaction.begin({ adapter: otherAdapter })
                const last = await Transaction.begin()

                expect(tx2.parent).toBe(tx1)
                expect(independent.parent).toBeUndefined()
                expect(different.parent).toBeUndefined()
                expect(last.parent).toBeUndefined()

                await tx1.commit()

                for (const transaction of [tx1, tx2, independent, different, last]) {
                    expect(transaction.status).toBe(TransactionStatus.Committed)
                }
                expect(current()).toBeUndefined()
            })

            expect(order).toEqual(['a#4', 'b#1', 'a#3', 'a#2', 'a#1'])
            expect(stack.size).toBe(0)
        })

        it('commits tx3 first when tx2 is committed while tx3 is open (user example)', async () => {
            const seen: Record<string, ITransaction | undefined> = {}
            let tx1: ITransaction | undefined
            let tx2: Transaction | undefined
            let tx3: Transaction | undefined

            await inContext(() =>
                Transaction.run(async (transaction) => {
                    tx1 = transaction
                    tx2 = await Transaction.begin()
                    tx3 = new Transaction()
                    await tx3.begin()

                    await tx2.commit()
                    seen.afterCommit2 = current()
                }),
            )

            expect(seen.afterCommit2).toBe(tx1!)
            expect([tx1!, tx2!, tx3!].map((tx) => tx.status)).toEqual([
                TransactionStatus.Committed,
                TransactionStatus.Committed,
                TransactionStatus.Committed,
            ])
            expect(operations()).toEqual([
                'begin#1@0',
                'begin#2@1',
                'begin#3@2',
                'commit#3@2',
                'commit#2@1',
                'commit#1@0',
            ])
        })

        it('stops a cascade at the first failed commit and leaves the target active', async () => {
            await inContext(async () => {
                const tx1 = await Transaction.begin()
                const tx2 = await Transaction.begin()
                const tx3 = await Transaction.begin()

                const commit = adapter.commit.bind(adapter)
                adapter.commit = async (transaction) => {
                    if (transaction === tx2) {
                        throw new Error('tx2 commit failure')
                    }
                    return commit(transaction)
                }

                await expect(tx1.commit()).rejects.toThrow('tx2 commit failure')

                expect(tx3.status).toBe(TransactionStatus.Committed)
                expect(tx2.status).toBe(TransactionStatus.Active)
                expect(tx1.status).toBe(TransactionStatus.Active)
                expect(current()).toBe(tx2)
                expect(stack.size).toBe(2)

                await tx1.rollback()
                expect(tx2.status).toBe(TransactionStatus.RolledBack)
                expect(tx1.status).toBe(TransactionStatus.RolledBack)
            })

            expect(operations()).toEqual([
                'begin#1@0',
                'begin#2@1',
                'begin#3@2',
                'commit#3@2',
                'rollback#2@1',
                'rollback#1@0',
            ])
        })

        it('rolls back everything above it first, innermost first', async () => {
            await inContext(async () => {
                const tx1 = await Transaction.begin()
                const tx2 = await Transaction.begin()
                const tx3 = await Transaction.begin()

                await tx1.rollback()

                expect([tx1, tx2, tx3].map((tx) => tx.status)).toEqual([
                    TransactionStatus.RolledBack,
                    TransactionStatus.RolledBack,
                    TransactionStatus.RolledBack,
                ])
                expect(current()).toBeUndefined()
            })

            expect(operations()).toEqual([
                'begin#1@0',
                'begin#2@1',
                'begin#3@2',
                'rollback#3@2',
                'rollback#2@1',
                'rollback#1@0',
            ])
        })

        it('stops a cascade at the first failed rollback and leaves the parent active', async () => {
            await inContext(async () => {
                const tx1 = await Transaction.begin()
                const tx2 = await Transaction.begin()
                const tx3 = await Transaction.begin()

                const rollback = adapter.rollback.bind(adapter)
                adapter.rollback = async (transaction) => {
                    if (transaction === tx2) {
                        throw new Error('tx2 rollback failure')
                    }
                    return rollback(transaction)
                }

                await expect(tx1.rollback()).rejects.toThrow('tx2 rollback failure')

                expect(tx3.status).toBe(TransactionStatus.RolledBack)
                expect(tx2.status).toBe(TransactionStatus.Active)
                expect(tx1.status).toBe(TransactionStatus.Active)
                expect(current()).toBe(tx2)
                expect(stack.size).toBe(2)
            })

            expect(operations()).toEqual(['begin#1@0', 'begin#2@1', 'begin#3@2', 'rollback#3@2'])
        })

        it('refuses to roll back with an open child in another async flow, touching nothing', async () => {
            await inContext(async () => {
                const parent = await Transaction.begin()
                const inner = await Transaction.begin()
                let release!: () => void
                let started!: () => void
                const isStarted = new Promise<void>((resolve) => (started = resolve))

                const running = parent.run(async () => {
                    started()
                    await new Promise<void>((resolve) => (release = resolve))
                })
                await isStarted

                await expect(parent.rollback()).rejects.toThrow(
                    'Cannot rollback a transaction with 1 open child transaction(s) in another async flow',
                )
                expect(parent.status).toBe(TransactionStatus.Active)
                expect(inner.status).toBe(TransactionStatus.Active)
                expect(current()).toBe(inner)

                release()
                await running
                await parent.rollback()
                expect(inner.status).toBe(TransactionStatus.RolledBack)
            })

            expect(operations()).toEqual([
                'begin#1@0',
                'begin#2@1',
                'begin#3@1',
                'commit#3@1',
                'rollback#2@1',
                'rollback#1@0',
            ])
        })
    })

    describe('static run', () => {
        it('commits and returns the result when the callback succeeds', async () => {
            const result = await inContext(() => Transaction.run(async () => 'done'))

            expect(result).toBe('done')
            expect(operations()).toEqual(['begin#1@0', 'commit#1@0'])
        })

        it('accepts a synchronous callback', async () => {
            expect(await inContext(() => Transaction.run(() => 42))).toBe(42)
        })

        it('rolls back and rethrows when the callback throws', async () => {
            let captured: ITransaction | undefined

            await expect(
                inContext(() =>
                    Transaction.run(async (transaction) => {
                        captured = transaction
                        throw new Error('boom')
                    }),
                ),
            ).rejects.toThrow('boom')

            expect(captured!.status).toBe(TransactionStatus.RolledBack)
            expect(operations()).toEqual(['begin#1@0', 'rollback#1@0'])
        })

        it('reports both errors when the rollback fails too', async () => {
            adapter.failures.rollback = true
            const error = new Error('boom')

            const failure = await inContext(() =>
                Transaction.run(async () => {
                    throw error
                }),
            ).catch((failure) => failure)

            expect(failure).toBeInstanceOf(AggregateError)
            expect(failure.message).toBe('Transaction failed, and so did its rollback')
            expect(failure.errors[0]).toBe(error)
            expect(failure.errors[1].message).toBe('Mock rollback failure')
        })

        it('rolls back when commit fails', async () => {
            adapter.failures.commit = true
            let captured: ITransaction | undefined

            await expect(
                inContext(() =>
                    Transaction.run(async (transaction) => {
                        captured = transaction
                    }),
                ),
            ).rejects.toThrow('Mock commit failure')

            expect(captured!.status).toBe(TransactionStatus.RolledBack)
            expect(operations()).toEqual(['begin#1@0', 'rollback#1@0'])
        })

        it('does not commit or roll back a transaction the callback already finished', async () => {
            await inContext(() =>
                Transaction.run(async (transaction) => {
                    await transaction.rollback()
                }),
            )
            await expect(
                inContext(() =>
                    Transaction.run(async (transaction) => {
                        await transaction.commit()
                        throw new Error('after commit')
                    }),
                ),
            ).rejects.toThrow('after commit')

            expect(operations()).toEqual(['begin#1@0', 'rollback#1@0', 'begin#2@0', 'commit#2@0'])
        })

        it('commits transactions the callback left open, innermost first', async () => {
            let leaked: Transaction | undefined
            let run: ITransaction | undefined

            const result = await inContext(() =>
                Transaction.run(async (transaction) => {
                    run = transaction
                    leaked = await Transaction.begin()
                    await Transaction.begin()
                    return 'done'
                }),
            )

            expect(result).toBe('done')
            expect(run!.status).toBe(TransactionStatus.Committed)
            expect(leaked!.status).toBe(TransactionStatus.Committed)
            expect(operations()).toEqual([
                'begin#1@0',
                'begin#2@1',
                'begin#3@2',
                'commit#3@2',
                'commit#2@1',
                'commit#1@0',
            ])
        })

        it('rolls back transactions the callback left open when it throws', async () => {
            await expect(
                inContext(() =>
                    Transaction.run(async () => {
                        await Transaction.begin()
                        throw new Error('boom')
                    }),
                ),
            ).rejects.toThrow('boom')

            expect(operations()).toEqual(['begin#1@0', 'begin#2@1', 'rollback#2@1', 'rollback#1@0'])
        })

        it('propagates a begin failure without running the callback', async () => {
            adapter.failures.begin = true
            let hasRun = false

            await expect(
                inContext(() =>
                    Transaction.run(async () => {
                        hasRun = true
                    }),
                ),
            ).rejects.toThrow('Mock begin failure')

            expect(hasRun).toBe(false)
        })

        it('works without an ambient context when given an adapter', async () => {
            await Transaction.run(
                async (transaction) => {
                    expect(useTransaction()).toBe(transaction)
                },
                { adapter },
            )

            expect(operations()).toEqual(['begin#1@0', 'commit#1@0'])
        })

        it('exposes a passed adapter to its callback when the context has none', async () => {
            await withContext(new Context(), () =>
                Transaction.run(
                    async (outer) => {
                        expect(useTransactionAdapter()).toBe(adapter)

                        await Transaction.run(async (nested) => {
                            expect(nested.parent).toBe(outer)
                            expect(useTransaction()).toBe(nested)
                        })
                    },
                    { adapter },
                ),
            )

            expect(operations()).toEqual(['begin#1@0', 'begin#2@1', 'commit#2@1', 'commit#1@0'])
        })

        it('exposes the run’s adapter over a different one on the ambient context', async () => {
            const otherAdapter = new MockTransactionAdapter()

            await inContext(() =>
                Transaction.run(
                    async (transaction) => {
                        expect(useTransactionAdapter()).toBe(otherAdapter)

                        const nested = await Transaction.begin()
                        expect(nested.parent).toBe(transaction)
                        await nested.commit()
                    },
                    { adapter: otherAdapter },
                ),
            )

            expect(adapter.operations).toEqual([])
            expect(otherAdapter.operations.map(({ operation, depth }) => `${operation}@${depth}`)).toEqual([
                'begin@0',
                'begin@1',
                'commit@1',
                'commit@0',
            ])
        })

        it('runs in a child of a context without a stack, tracking its transaction there', async () => {
            const bare = new Context<ITransactionScope>()
            bare.registerValue('transactionAdapter', adapter)

            await withContext(bare, () =>
                Transaction.run(async (transaction) => {
                    expect(useContext()).not.toBe(bare)
                    expect(useTransaction()).toBe(transaction)
                    const nested = await Transaction.begin()
                    expect(nested.parent).toBe(transaction)
                }),
            )

            expect(bare.resolve('transactionStack')).toBeUndefined()
            expect(operations()).toEqual(['begin#1@0', 'begin#2@1', 'commit#2@1', 'commit#1@0'])
        })

        it('gives the run its own stack, leaving the outer one untouched', async () => {
            await inContext(() =>
                Transaction.run(async (transaction) => {
                    expect(stack.size).toBe(0)
                    expect(useTransaction()).toBe(transaction)
                }),
            )
        })

        it('nests in the outer stack’s current transaction', async () => {
            await inContext(async () => {
                const outer = await Transaction.begin()

                await Transaction.run(async (nested) => {
                    expect(nested.parent).toBe(outer)
                    expect(useTransaction()).toBe(nested)
                })

                expect(current()).toBe(outer)
                await outer.commit()
            })

            expect(operations()).toEqual(['begin#1@0', 'begin#2@1', 'commit#2@1', 'commit#1@0'])
        })

        it('nests runs in runs, and restores the outer transaction after', async () => {
            await inContext(() =>
                Transaction.run(async (outer) => {
                    await Transaction.run(async (nested) => {
                        expect(nested.parent).toBe(outer)
                        expect(nested.depth).toBe(1)
                        expect(useTransaction()).toBe(nested)
                    })

                    expect(useTransaction()).toBe(outer)
                }),
            )

            expect(operations()).toEqual(['begin#1@0', 'begin#2@1', 'commit#2@1', 'commit#1@0'])
        })

        it('does not nest in a transaction with a different adapter', async () => {
            const otherAdapter = new MockTransactionAdapter()

            await inContext(() =>
                Transaction.run(async () => {
                    await Transaction.run(
                        async (other) => {
                            expect(other.parent).toBeUndefined()
                        },
                        { adapter: otherAdapter },
                    )
                }),
            )
        })

        it('runs a separate top-level transaction with parent: null', async () => {
            await inContext(() =>
                Transaction.run(async (outer) => {
                    await Transaction.run(
                        async (independent) => {
                            expect(independent.parent).toBeUndefined()
                            expect(useTransaction()).toBe(independent)
                        },
                        { parent: null },
                    )

                    expect(useTransaction()).toBe(outer)
                }),
            )

            expect(operations()).toEqual(['begin#1@0', 'begin#2@0', 'commit#2@0', 'commit#1@0'])
        })

        it('rolls back only the nested transaction when its error is caught', async () => {
            await inContext(() =>
                Transaction.run(async () => {
                    await Transaction.run(async () => {
                        throw new Error('nested failure')
                    }).catch(() => {})
                }),
            )

            expect(operations()).toEqual(['begin#1@0', 'begin#2@1', 'rollback#2@1', 'commit#1@0'])
        })

        it('rolls back every level when a nested error escapes', async () => {
            await expect(
                inContext(() =>
                    Transaction.run(async () => {
                        await Transaction.run(async () => {
                            await Transaction.run(async () => {
                                throw new Error('deep failure')
                            })
                        })
                    }),
                ),
            ).rejects.toThrow('deep failure')

            expect(operations()).toEqual([
                'begin#1@0',
                'begin#2@1',
                'begin#3@2',
                'rollback#3@2',
                'rollback#2@1',
                'rollback#1@0',
            ])
        })

        it('keeps concurrent runs isolated', async () => {
            const seen = await inContext(() =>
                Promise.all(
                    [1, 2].map((n) =>
                        Transaction.run(async (transaction) => {
                            await new Promise((resolve) => setTimeout(resolve, 5 * n))
                            const nested = await Transaction.begin()
                            const isIsolated =
                                nested.parent === transaction && useTransaction() === nested && transaction.depth === 0
                            await nested.commit()
                            return isIsolated && useTransaction() === transaction
                        }),
                    ),
                ),
            )

            expect(seen).toEqual([true, true])
            expect(stack.size).toBe(0)
        })

        it('keeps concurrent top-level runs started inside a run isolated', async () => {
            await inContext(() =>
                Transaction.run(async () => {
                    const seen = await Promise.all(
                        [1, 2].map((n) =>
                            Transaction.run(
                                async (independent) => {
                                    await new Promise((resolve) => setTimeout(resolve, 5 * n))
                                    return useTransaction() === independent && independent.parent === undefined
                                },
                                { parent: null },
                            ),
                        ),
                    )

                    expect(seen).toEqual([true, true])
                }),
            )
        })

        it('makes useTransaction() throw in work the callback did not await', async () => {
            let late: Promise<unknown> | undefined

            await inContext(() =>
                Transaction.run(async () => {
                    late = new Promise((resolve) => setTimeout(resolve, 5)).then(() => useTransaction())
                }),
            )

            await expect(late!).rejects.toThrow('No transaction is active in the current context')
        })
    })

    describe('cascading from inside runs', () => {
        /** A promise with its resolver, to hold a run open. */
        const deferred = () => {
            let resolve!: () => void
            const promise = new Promise<void>((done) => (resolve = done))
            return { promise, resolve }
        }

        for (const operation of ['commit', 'rollback'] as const) {
            const finished = operation === 'commit' ? TransactionStatus.Committed : TransactionStatus.RolledBack

            it(`${operation}s the nested run's transactions when tx1.${operation}() is called inside tx1.run()`, async () => {
                let tx1: ITransaction | undefined
                let child: ITransaction | undefined
                let inner: Transaction | undefined
                let afterFinish: ITransaction | undefined

                const result = await inContext(() =>
                    Transaction.run(async (transaction) => {
                        tx1 = transaction
                        return transaction.run(async (nested) => {
                            child = nested
                            inner = await Transaction.begin()
                            await transaction[operation]()
                            afterFinish = current()
                            return 'child result'
                        })
                    }),
                )

                expect(result).toBe('child result')
                expect(afterFinish).toBeUndefined()
                expect([tx1!, child!, inner!].map((tx) => tx.status)).toEqual([finished, finished, finished])
                expect(operations()).toEqual([
                    'begin#1@0',
                    'begin#2@1',
                    'begin#3@2',
                    `${operation}#3@2`,
                    `${operation}#2@1`,
                    `${operation}#1@0`,
                ])
            })

            it(`${operation}s every run in between when tx1.${operation}() is called inside nested Transaction.run()`, async () => {
                const transactions: ITransaction[] = []
                let innerResult: string | undefined

                const result = await inContext(() =>
                    Transaction.run(async (tx1) => {
                        transactions.push(tx1)
                        const started = await Transaction.begin()
                        transactions.push(started)

                        innerResult = await Transaction.run(async (tx3) => {
                            transactions.push(tx3)
                            return Transaction.run(async (tx4) => {
                                transactions.push(tx4, await Transaction.begin())
                                await tx1[operation]()
                                return 'nested result'
                            })
                        })

                        expect(current()).toBeUndefined()
                        return 'outer result'
                    }),
                )

                expect(result).toBe('outer result')
                expect(innerResult).toBe('nested result')
                expect(transactions.map((tx) => tx.status)).toEqual(transactions.map(() => finished))
                expect(transactions.map((tx) => tx.depth)).toEqual([0, 1, 2, 3, 4])
                expect(operations()).toEqual([
                    'begin#1@0',
                    'begin#2@1',
                    'begin#3@2',
                    'begin#4@3',
                    'begin#5@4',
                    `${operation}#5@4`,
                    `${operation}#4@3`,
                    `${operation}#3@2`,
                    `${operation}#2@1`,
                    `${operation}#1@0`,
                ])
            })

            it(`throws from ${operation}() with a child open in a concurrent run, touching nothing`, async () => {
                const held = deferred()
                const started = deferred()
                let before: string[] = []

                await inContext(() =>
                    Transaction.run(async (tx1) => {
                        const blocked = Transaction.run(async () => {
                            started.resolve()
                            await held.promise
                        })
                        await started.promise

                        before = operations()
                        await expect(tx1[operation]()).rejects.toThrow(
                            `Cannot ${operation} a transaction with 1 open child transaction(s) in another async flow`,
                        )

                        expect(operations()).toEqual(before)
                        expect(tx1.status).toBe(TransactionStatus.Active)
                        expect(current()).toBe(tx1)
                        held.resolve()
                        await blocked
                    }),
                )

                expect(before).toEqual(['begin#1@0', 'begin#2@1'])
                expect(operations().slice(2)).toEqual(['commit#2@1', 'commit#1@0'])
            })
        }

        it('cascades into a parent: null run begun inside the flow', async () => {
            await inContext(() =>
                Transaction.run(async (tx1) => {
                    await Transaction.run(
                        async (independent) => {
                            expect(independent.parent).toBeUndefined()
                            await tx1.commit()
                        },
                        { parent: null },
                    )
                }),
            )

            expect(operations()).toEqual(['begin#1@0', 'begin#2@0', 'commit#2@0', 'commit#1@0'])
        })
    })

    describe('parallel nested runs', () => {
        const PARALLEL_ERROR =
            'Cannot begin a nested transaction while its parent (depth 0) already has an active child in another async flow. Run parallel work in top-level transactions (parent: null) instead.'

        /** A promise with its resolver, to hold a run open. */
        const deferred = () => {
            let resolve!: () => void
            const promise = new Promise<void>((done) => (resolve = done))
            return { promise, resolve }
        }

        it('refuses to begin a second Transaction.run() started in parallel under the same parent', async () => {
            const held = deferred()
            let first: ITransaction | undefined
            let secondRan = false

            await inContext(() =>
                Transaction.run(async (outer) => {
                    const a = Transaction.run(async (nested) => {
                        first = nested
                        await held.promise
                        return 'a'
                    })
                    const b = Transaction.run(async () => {
                        secondRan = true
                    })

                    await expect(Promise.all([a, b])).rejects.toThrow(PARALLEL_ERROR)
                    expect(secondRan).toBe(false)
                    expect(first!.status).toBe(TransactionStatus.Active)

                    held.resolve()
                    expect(await a).toBe('a')
                    expect(first!.status).toBe(TransactionStatus.Committed)
                    expect(outer.status).toBe(TransactionStatus.Active)
                }),
            )

            expect(operations()).toEqual(['begin#1@0', 'begin#2@1', 'commit#2@1', 'commit#1@0'])
        })

        it('refuses a second concurrent tx.run() on the same transaction, leaving no trace', async () => {
            const held = deferred()
            const started = deferred()

            await inContext(async () => {
                const tx = await Transaction.begin()
                const a = tx.run(async () => {
                    started.resolve()
                    await held.promise
                })
                await started.promise

                await expect(tx.run(async () => {})).rejects.toThrow(PARALLEL_ERROR)
                expect(operations()).toEqual(['begin#1@0', 'begin#2@1'])

                held.resolve()
                await a
                await tx.commit()
                expect(tx.status).toBe(TransactionStatus.Committed)
            })

            expect(operations()).toEqual(['begin#1@0', 'begin#2@1', 'commit#2@1', 'commit#1@0'])
        })

        it('leaves a transaction whose begin was refused pending, off every stack', async () => {
            const held = deferred()
            const started = deferred()

            await inContext(async () => {
                const tx = await Transaction.begin()
                const a = tx.run(async () => {
                    started.resolve()
                    await held.promise
                })
                await started.promise

                const refused = new Transaction({ parent: tx })
                await expect(refused.begin()).rejects.toThrow(PARALLEL_ERROR)
                expect(refused.status).toBe(TransactionStatus.Pending)
                expect(refused.parent).toBeUndefined()
                expect(stack.all()).toEqual([tx])

                held.resolve()
                await a
                // Only the finished run's child was tracked: the parent commits without a cascade error.
                await tx.commit()
            })

            expect(operations()).toEqual(['begin#1@0', 'begin#2@1', 'commit#2@1', 'commit#1@0'])
        })

        it('still allows sequential nested runs', async () => {
            await inContext(() =>
                Transaction.run(async (outer) => {
                    await Transaction.run(async (nested) => expect(nested.parent).toBe(outer))
                    await outer.run(async (nested) => expect(nested.parent).toBe(outer))
                    await Transaction.run(async (nested) => expect(nested.parent).toBe(outer))
                }),
            )

            expect(operations()).toEqual([
                'begin#1@0',
                'begin#2@1',
                'commit#2@1',
                'begin#3@1',
                'commit#3@1',
                'begin#4@1',
                'commit#4@1',
                'commit#1@0',
            ])
        })

        it('still allows a grandchild begun inside a child run, and a child of the outer one from inside it', async () => {
            await inContext(() =>
                Transaction.run(async (outer) => {
                    await Transaction.run(async (child) => {
                        await Transaction.run(async (grandchild) => expect(grandchild.parent).toBe(child))
                        await child.run(async (grandchild) => expect(grandchild.parent).toBe(child))
                        await Transaction.run(async (sibling) => expect(sibling.parent).toBe(outer), { parent: outer })
                    })
                }),
            )

            expect(operations()).toEqual([
                'begin#1@0',
                'begin#2@1',
                'begin#3@2',
                'commit#3@2',
                'begin#4@2',
                'commit#4@2',
                'begin#5@1',
                'commit#5@1',
                'commit#2@1',
                'commit#1@0',
            ])
        })

        it('still allows parallel top-level runs (parent: null) inside a run, each committing', async () => {
            const held = deferred()
            const runs: ITransaction[] = []

            await inContext(() =>
                Transaction.run(async () => {
                    const a = Transaction.run(
                        async (independent) => {
                            runs.push(independent)
                            await held.promise
                        },
                        { parent: null },
                    )
                    const b = Transaction.run(
                        async (independent) => {
                            runs.push(independent)
                            held.resolve()
                        },
                        { parent: null },
                    )
                    await Promise.all([a, b])
                }),
            )

            expect(runs.map((tx) => [tx.parent, tx.status])).toEqual([
                [undefined, TransactionStatus.Committed],
                [undefined, TransactionStatus.Committed],
            ])
            expect(operations().sort()).toEqual(
                ['begin#1@0', 'begin#2@0', 'begin#3@0', 'commit#1@0', 'commit#2@0', 'commit#3@0'].sort(),
            )
        })
    })

    describe('instance run', () => {
        it('requires an active transaction', async () => {
            const transaction = new Transaction({ adapter })
            await expect(transaction.run(async () => {})).rejects.toThrow(
                'Cannot run a child of a transaction that is pending',
            )
        })

        it('runs the callback in a child transaction that is current, from outside the context it began in', async () => {
            const transaction = await inContext(() => Transaction.begin())

            const result = await transaction.run(async (child) => {
                expect(child).not.toBe(transaction)
                expect(child.parent).toBe(transaction)
                expect(child.depth).toBe(1)
                expect(useTransaction()).toBe(child)
                return 'child result'
            })

            expect(result).toBe('child result')
            expect(transaction.status).toBe(TransactionStatus.Active)
            expect(stack.current).toBe(transaction)
            expect(operations()).toEqual(['begin#1@0', 'begin#2@1', 'commit#2@1'])
        })

        it('rolls back only the child when its callback throws', async () => {
            const transaction = await inContext(() => Transaction.begin())

            await expect(
                transaction.run(async () => {
                    throw new Error('child failure')
                }),
            ).rejects.toThrow('child failure')

            expect(transaction.status).toBe(TransactionStatus.Active)
            expect(operations()).toEqual(['begin#1@0', 'begin#2@1', 'rollback#2@1'])
        })

        it('nests further from inside a child', async () => {
            await inContext(() =>
                Transaction.run(async (outer) => {
                    await outer.run(async (middle) => {
                        await middle.run(async (inner) => {
                            expect(inner.depth).toBe(2)
                            expect(useTransaction()).toBe(inner)
                        })
                    })
                }),
            )

            expect(operations()).toEqual([
                'begin#1@0',
                'begin#2@1',
                'begin#3@2',
                'commit#3@2',
                'commit#2@1',
                'commit#1@0',
            ])
        })
    })

    describe('the adapter context', () => {
        /** A mock adapter that records the ambient context of each call, as `operation` and the context. */
        class ContextRecordingAdapter extends MockTransactionAdapter {
            readonly seen: { operation: string; context: Context | null }[] = []

            override async begin(transaction: ITransaction) {
                this.seen.push({ operation: 'begin', context: useContext() })
                await super.begin(transaction)
            }

            override async commit(transaction: ITransaction) {
                this.seen.push({ operation: 'commit', context: useContext() })
                await super.commit(transaction)
            }

            override async rollback(transaction: ITransaction) {
                this.seen.push({ operation: 'rollback', context: useContext() })
                await super.rollback(transaction)
            }
        }

        let recording: ContextRecordingAdapter
        let ambient: Context<ITransactionScope>

        beforeEach(() => {
            recording = new ContextRecordingAdapter()
            context.registerValue('transactionAdapter', recording)
            ambient = new Context<ITransactionScope>()
            ambient.registerValue('transactionAdapter', recording)
            ambient.registerValue('transactionStack', new TransactionStack())
        })

        const inAmbient = <T>(fn: () => T) => withContext(ambient, fn)
        const contexts = () => recording.seen.map(({ context }) => context)

        it('calls the adapter in the context the transaction began in, wherever it is finished', async () => {
            const committed = await inContext(() => Transaction.begin())
            await inAmbient(() => committed.commit())

            const rolledBack = await inContext(() => Transaction.begin())
            await rolledBack.rollback()

            expect(recording.seen.map(({ operation }) => operation)).toEqual(['begin', 'commit', 'begin', 'rollback'])
            expect(contexts()).toEqual([context, context, context, context])
        })

        it('calls the adapter of a run in the run’s context, a child of the current one', async () => {
            await inContext(() =>
                Transaction.run(async (transaction) => {
                    await transaction.run(() => undefined)
                }),
            )

            const [outerBegin, innerBegin, innerCommit, outerCommit] = contexts()
            expect(recording.seen.map(({ operation }) => operation)).toEqual(['begin', 'begin', 'commit', 'commit'])
            expect(outerCommit).toBe(outerBegin!)
            expect(innerCommit).toBe(innerBegin!)
            expect(innerBegin).not.toBe(outerBegin!)
            expect(outerBegin).not.toBe(context)
            // The run's context extends the current one, so the adapter resolves the same dependencies.
            expect(outerBegin!.resolve('transactionAdapter')).toBe(recording)
        })

        it('calls the adapter as is for a transaction begun with no context', async () => {
            const transaction = await Transaction.begin({ adapter: recording })
            await inAmbient(() => transaction.commit())

            // Nothing was captured, so each call sees whatever context is current when it is made.
            expect(contexts()).toEqual([null, ambient])
        })

        it('calls the adapter in the current context when it begins', async () => {
            await inAmbient(async () => {
                const transaction = await Transaction.begin()
                await transaction.commit()
            })

            expect(contexts()).toEqual([ambient, ambient])
        })
    })
})
