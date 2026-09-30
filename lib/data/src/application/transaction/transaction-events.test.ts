import { Context, createRequestContext, EventManager, useDeclaro, withContext, type Request } from '@declaro/core'
import { beforeEach, describe, expect, it } from 'bun:test'
import { TransactionEvent, TransactionLifecycleEvent } from '../../domain/events/transaction-event'
import { TransactionStatus, type ITransaction } from '../../domain/transaction/transaction-interface'
import { MockTransactionAdapter } from '../../test/mock/transaction/mock-transaction-adapter'
import type { DataScope } from '../../types/data-context'
import type { ITransactionScope } from '../../types/transaction-context'
import { Transaction } from './transaction'
import { transactionModule } from './transaction-module'
import { TransactionStack } from './transaction-stack'

describe('Transaction lifecycle events', () => {
    let adapter: MockTransactionAdapter
    let context: Context<ITransactionScope>
    let stack: TransactionStack
    let events: TransactionLifecycleEvent[]

    /** The adapter log as `operation#id@depth`. */
    const operations = () =>
        adapter.operations.map(({ operation, transactionId, depth }) => `${operation}#${transactionId}@${depth}`)
    const inContext = <T>(fn: () => T) => withContext(context, fn)
    /** The received events as `action@depth:status`. */
    const received = () =>
        events.map((event) => `${event.descriptor.action}@${event.data?.depth}:${event.data?.status}`)
    /** Makes the listeners for `action` throw `message`. */
    const failOn = (action: TransactionEvent, message = `${action} listener failure`) =>
        context.events.on(TransactionLifecycleEvent.getType(action), () => {
            throw new Error(message)
        })

    beforeEach(() => {
        adapter = new MockTransactionAdapter()
        stack = new TransactionStack()
        context = new Context<ITransactionScope>()
        context.registerValue('transactionAdapter', adapter)
        context.registerValue('transactionStack', stack)
        events = []
        context.events.on('*', (event) => {
            events.push(event as TransactionLifecycleEvent)
        })
    })

    describe('sequence and types', () => {
        it('emits begin and commit events for a top-level transaction', async () => {
            const transaction = await inContext(() => Transaction.begin())
            await inContext(() => transaction.commit())

            expect(events.map((event) => event.type)).toEqual([
                'declaro::transaction.beforeBegin',
                'declaro::transaction.afterBegin',
                'declaro::transaction.beforeCommit',
                'declaro::transaction.afterCommit',
            ])
            expect(received()).toEqual([
                'beforeBegin@0:pending',
                'afterBegin@0:active',
                'beforeCommit@0:active',
                'afterCommit@0:committed',
            ])
            expect(events.every((event) => event instanceof TransactionLifecycleEvent)).toBe(true)
            expect(events.every((event) => event.transaction === transaction)).toBe(true)
            expect(events.every((event) => event.data?.id === transaction.id)).toBe(true)
        })

        it('emits begin and rollback events for a top-level transaction', async () => {
            await inContext(async () => {
                const transaction = await Transaction.begin()
                await transaction.rollback()
            })

            expect(events.map((event) => event.type)).toEqual([
                'declaro::transaction.beforeBegin',
                'declaro::transaction.afterBegin',
                'declaro::transaction.beforeRollback',
                'declaro::transaction.afterRollback',
            ])
            expect(received()).toEqual([
                'beforeBegin@0:pending',
                'afterBegin@0:active',
                'beforeRollback@0:active',
                'afterRollback@0:rolled-back',
            ])
        })

        it('emits events for nested transactions, with their parent id', async () => {
            let outer!: Transaction
            let inner!: Transaction
            let rolledBack!: Transaction

            await inContext(async () => {
                outer = await Transaction.begin()
                inner = await Transaction.begin()
                await inner.commit()
                rolledBack = await Transaction.begin()
                await rolledBack.rollback()
                await outer.commit()
            })

            expect(received()).toEqual([
                'beforeBegin@0:pending',
                'afterBegin@0:active',
                'beforeBegin@1:pending',
                'afterBegin@1:active',
                'beforeCommit@1:active',
                'afterCommit@1:committed',
                'beforeBegin@1:pending',
                'afterBegin@1:active',
                'beforeRollback@1:active',
                'afterRollback@1:rolled-back',
                'beforeCommit@0:active',
                'afterCommit@0:committed',
            ])
            expect(events.map((event) => event.data?.id)).toEqual([
                ...Array(2).fill(outer.id),
                ...Array(4).fill(inner.id),
                ...Array(4).fill(rolledBack.id),
                ...Array(2).fill(outer.id),
            ])
            expect(events.slice(2, 10).every((event) => event.data?.parentId === outer.id)).toBe(true)
            expect(
                events.filter((event) => event.transaction === outer).every((event) => !('parentId' in event.data!)),
            ).toBe(true)
        })

        it('builds the types from the TransactionEvent actions', () => {
            expect(Object.values(TransactionEvent).map((action) => TransactionLifecycleEvent.getType(action))).toEqual([
                'declaro::transaction.beforeBegin',
                'declaro::transaction.afterBegin',
                'declaro::transaction.beforeCommit',
                'declaro::transaction.afterCommit',
                'declaro::transaction.beforeRollback',
                'declaro::transaction.afterRollback',
            ])
        })

        it('emits each cascaded commit innermost first', async () => {
            await inContext(async () => {
                await Transaction.begin()
                await Transaction.begin()
                const innermost = await Transaction.begin()
                events = []

                await stack.all()[0]!.commit()
                expect(innermost.status).toBe(TransactionStatus.Committed)
            })

            expect(received()).toEqual([
                'beforeCommit@2:active',
                'afterCommit@2:committed',
                'beforeCommit@1:active',
                'afterCommit@1:committed',
                'beforeCommit@0:active',
                'afterCommit@0:committed',
            ])
        })

        it('emits each cascaded rollback innermost first, including runs the caller is inside', async () => {
            await inContext(() =>
                Transaction.run(async (outer) => {
                    await outer.run(async () => {
                        await Transaction.begin()
                        events = []
                        await outer.rollback()
                    })
                }),
            )

            expect(received()).toEqual([
                'beforeRollback@2:active',
                'afterRollback@2:rolled-back',
                'beforeRollback@1:active',
                'afterRollback@1:rolled-back',
                'beforeRollback@0:active',
                'afterRollback@0:rolled-back',
            ])
        })
    })

    describe('before listeners', () => {
        it('stops begin when beforeBegin throws', async () => {
            failOn(TransactionEvent.BeforeBegin)
            const transaction = new Transaction({ context })

            await expect(transaction.begin()).rejects.toThrow('beforeBegin listener failure')

            expect(transaction.status).toBe(TransactionStatus.Pending)
            expect(transaction.parent).toBeUndefined()
            expect(stack.size).toBe(0)
            expect(operations()).toEqual([])
            // Listeners for a specific type run before '*' listeners, so the recorder never saw it.
            expect(received()).toEqual([])
        })

        it('stops commit when beforeCommit throws', async () => {
            const transaction = await Transaction.begin({ context })
            failOn(TransactionEvent.BeforeCommit)

            await expect(inContext(() => transaction.commit())).rejects.toThrow('beforeCommit listener failure')

            expect(transaction.status).toBe(TransactionStatus.Active)
            expect(stack.current).toBe(transaction)
            expect(operations()).toEqual(['begin#1@0'])
        })

        it('stops rollback when beforeRollback throws', async () => {
            const transaction = await Transaction.begin({ context })
            failOn(TransactionEvent.BeforeRollback)

            await expect(inContext(() => transaction.rollback())).rejects.toThrow('beforeRollback listener failure')

            expect(transaction.status).toBe(TransactionStatus.Active)
            expect(stack.current).toBe(transaction)
            expect(operations()).toEqual(['begin#1@0'])
        })

        it('makes a run roll back when beforeCommit throws', async () => {
            failOn(TransactionEvent.BeforeCommit)
            let run: ITransaction | undefined

            await expect(
                inContext(() =>
                    Transaction.run((transaction) => {
                        run = transaction
                    }),
                ),
            ).rejects.toThrow('beforeCommit listener failure')

            expect(run?.status).toBe(TransactionStatus.RolledBack)
            expect(operations()).toEqual(['begin#1@0', 'rollback#1@0'])
            expect(received()).toEqual([
                'beforeBegin@0:pending',
                'afterBegin@0:active',
                'beforeRollback@0:active',
                'afterRollback@0:rolled-back',
            ])
        })
    })

    describe('after listeners', () => {
        it('propagates an afterBegin failure with the transaction already active', async () => {
            failOn(TransactionEvent.AfterBegin)
            const transaction = new Transaction({ context })

            await expect(transaction.begin()).rejects.toThrow('afterBegin listener failure')

            expect(transaction.status).toBe(TransactionStatus.Active)
            expect(stack.current).toBe(transaction)
            expect(operations()).toEqual(['begin#1@0'])
        })

        it('rolls back and rethrows from Transaction.begin() when afterBegin throws', async () => {
            failOn(TransactionEvent.AfterBegin)

            await expect(Transaction.begin({ context })).rejects.toThrow('afterBegin listener failure')

            expect(stack.size).toBe(0)
            expect(operations()).toEqual(['begin#1@0', 'rollback#1@0'])
        })

        it('throws an AggregateError from Transaction.begin() when the rollback after afterBegin fails too', async () => {
            failOn(TransactionEvent.AfterBegin)
            adapter.failures.rollback = true

            const error = await Transaction.begin({ context }).catch((error: unknown) => error)

            expect(error).toBeInstanceOf(AggregateError)
            expect((error as AggregateError).message).toBe('Transaction failed, and so did its rollback')
            expect((error as AggregateError).errors.map((inner: Error) => inner.message)).toEqual([
                'afterBegin listener failure',
                'Mock rollback failure',
            ])
            expect(operations()).toEqual(['begin#1@0'])
        })

        it('propagates an afterCommit failure with the transaction already committed', async () => {
            const transaction = await Transaction.begin({ context })
            failOn(TransactionEvent.AfterCommit)

            await expect(inContext(() => transaction.commit())).rejects.toThrow('afterCommit listener failure')

            expect(transaction.status).toBe(TransactionStatus.Committed)
            expect(stack.size).toBe(0)
            expect(operations()).toEqual(['begin#1@0', 'commit#1@0'])
        })

        it('propagates an afterRollback failure with the transaction already rolled back', async () => {
            const transaction = await Transaction.begin({ context })
            failOn(TransactionEvent.AfterRollback)

            await expect(inContext(() => transaction.rollback())).rejects.toThrow('afterRollback listener failure')

            expect(transaction.status).toBe(TransactionStatus.RolledBack)
            expect(stack.size).toBe(0)
            expect(operations()).toEqual(['begin#1@0', 'rollback#1@0'])
        })

        it('rethrows an afterCommit listener failure from a run without rolling back', async () => {
            failOn(TransactionEvent.AfterCommit)

            await expect(inContext(() => Transaction.run(() => 'done'))).rejects.toThrow('afterCommit listener failure')

            expect(operations()).toEqual(['begin#1@0', 'commit#1@0'])
        })

        it('rolls a run back without running its callback when afterBegin throws', async () => {
            failOn(TransactionEvent.AfterBegin)
            let ran = false

            await expect(
                inContext(() =>
                    Transaction.run(() => {
                        ran = true
                    }),
                ),
            ).rejects.toThrow('afterBegin listener failure')

            expect(ran).toBe(false)
            expect(operations()).toEqual(['begin#1@0', 'rollback#1@0'])
        })
    })

    describe('top-level commit order', () => {
        it('runs afterCommit callbacks before the afterCommit event', async () => {
            const order: string[] = []
            context.events.on(TransactionLifecycleEvent.getType(TransactionEvent.AfterCommit), (event) => {
                order.push(`event (${(event as TransactionLifecycleEvent).data?.status})`)
            })

            await inContext(async () => {
                const transaction = await Transaction.begin()
                transaction.afterCommit(() => {
                    order.push(`callback (${transaction.status}, ${adapter.operations.length} operations)`)
                })
                await transaction.commit()
            })

            expect(order).toEqual(['callback (committed, 2 operations)', 'event (committed)'])
        })

        it('skips the afterCommit event when a callback fails', async () => {
            await inContext(async () => {
                const transaction = await Transaction.begin()
                transaction.afterCommit(() => {
                    throw new Error('callback failure')
                })
                await expect(transaction.commit()).rejects.toThrow('callback failure')
                expect(transaction.status).toBe(TransactionStatus.Committed)
            })

            expect(received()).toEqual(['beforeBegin@0:pending', 'afterBegin@0:active', 'beforeCommit@0:active'])
        })

        it('moves nested callbacks to the parent before the nested afterCommit event', async () => {
            const order: string[] = []

            await inContext(async () => {
                const outer = await Transaction.begin()
                const inner = await Transaction.begin()
                inner.afterCommit(() => {
                    order.push('callback')
                })
                context.events.on(TransactionLifecycleEvent.getType(TransactionEvent.AfterCommit), (event) => {
                    const { transaction } = event as TransactionLifecycleEvent
                    order.push(`event@${transaction.depth}`)
                    if (transaction === inner) {
                        // The callback has moved: a new one can still be added to the active parent.
                        outer.afterCommit(() => {
                            order.push('added by listener')
                        })
                    }
                })

                await inner.commit()
                expect(order).toEqual(['event@1'])
                await outer.commit()
            })

            expect(order).toEqual(['event@1', 'callback', 'added by listener', 'event@0'])
        })
    })

    describe('serialization', () => {
        it('serializes only a plain summary, keeping the live transaction in-process', async () => {
            let outer!: Transaction
            let inner!: Transaction
            await inContext(async () => {
                outer = await Transaction.begin()
                inner = await Transaction.begin()
            })
            const event = events.find((candidate) => candidate.transaction === inner)!

            const json = JSON.stringify(event)
            const parsed = JSON.parse(json)

            expect(parsed.type).toBe('declaro::transaction.beforeBegin')
            expect(parsed.data).toEqual({ id: inner.id, depth: 1, status: 'pending', parentId: outer.id })
            expect(Object.keys(parsed).sort()).toEqual(['data', 'eventId', 'meta', 'timestamp', 'type'])
            expect(json).not.toMatch(/adapter|stack|openChildren|transaction"|operations/i)
            // The spread and the plain event serialization skip the live transaction too.
            expect(Object.keys(event)).not.toContain('transaction')
            expect(Object.keys({ ...event })).not.toContain('transaction')
            expect(JSON.stringify({ ...event })).not.toMatch(/adapter|stack|openChildren|operations/i)

            expect(event.transaction).toBe(inner)
            expect(event.transaction.parent).toBe(outer)
        })
    })

    describe('emitter', () => {
        it('emits to an explicit emitter instead of the context', async () => {
            const emitter = new EventManager()
            const own: string[] = []
            emitter.on('*', (event) => {
                own.push(event.type)
            })

            await inContext(async () => {
                const transaction = await Transaction.begin({ emitter })
                await transaction.commit()
                await Transaction.run(() => undefined, { emitter })
            })

            expect(events).toEqual([])
            expect(own).toEqual([
                'declaro::transaction.beforeBegin',
                'declaro::transaction.afterBegin',
                'declaro::transaction.beforeCommit',
                'declaro::transaction.afterCommit',
                'declaro::transaction.beforeBegin',
                'declaro::transaction.afterBegin',
                'declaro::transaction.beforeCommit',
                'declaro::transaction.afterCommit',
            ])
        })

        it('emits to the explicit context’s events', async () => {
            const other = new Context<ITransactionScope>()
            other.registerValue('transactionAdapter', adapter)
            other.registerValue('transactionStack', new TransactionStack())
            const otherEvents: string[] = []
            other.events.on('*', (event) => {
                otherEvents.push((event as TransactionLifecycleEvent).descriptor.action)
            })

            await inContext(async () => {
                const transaction = await Transaction.begin({ context: other })
                await transaction.rollback()
            })

            expect(events).toEqual([])
            expect(otherEvents).toEqual(['beforeBegin', 'afterBegin', 'beforeRollback', 'afterRollback'])
        })
    })

    describe('listeners on the app context', () => {
        const request = { headers: {} } as unknown as Request

        let appContext: Context<DataScope>
        let appEvents: string[]

        beforeEach(async () => {
            appContext = new Context<DataScope>()
            await appContext.use(useDeclaro(), transactionModule({ adapter }))
            appEvents = []
        })

        const describeEvent = (event: TransactionLifecycleEvent) => `${event.descriptor.action}@${event.data?.depth}`

        it('receives events of a transaction begun in a request context (app.on)', async () => {
            appContext.on('*', (_context, event) => {
                appEvents.push(describeEvent(event as TransactionLifecycleEvent))
            })
            const requestContext = await createRequestContext(appContext, request)

            await withContext(requestContext, async () => {
                const transaction = await Transaction.begin()
                await transaction.commit()
            })

            expect(appEvents).toEqual(['beforeBegin@0', 'afterBegin@0', 'beforeCommit@0', 'afterCommit@0'])
        })

        it('receives events of transactions begun inside nested runs (app.events.on)', async () => {
            appContext.events.on(TransactionLifecycleEvent.getType(TransactionEvent.AfterCommit), (event) => {
                appEvents.push(describeEvent(event as TransactionLifecycleEvent))
            })
            appContext.events.on(TransactionLifecycleEvent.getType(TransactionEvent.AfterBegin), (event) => {
                appEvents.push(describeEvent(event as TransactionLifecycleEvent))
            })
            const requestContext = await createRequestContext(appContext, request)

            await withContext(requestContext, async () => {
                const outer = await Transaction.begin()
                await Transaction.run(async (run) => {
                    await run.run(async () => {
                        const manual = await Transaction.begin()
                        await manual.commit()
                    })
                })
                await outer.commit()
            })

            expect(appEvents).toEqual([
                'afterBegin@0',
                'afterBegin@1',
                'afterBegin@2',
                'afterBegin@3',
                'afterCommit@3',
                'afterCommit@2',
                'afterCommit@1',
                'afterCommit@0',
            ])
        })
    })
})
