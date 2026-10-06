import { Context, createRequestContext, useDeclaro, withContext, type Request } from '@declaro/core'
import { beforeEach, describe, expect, it } from 'bun:test'
import { EventEmitter, once } from 'node:events'
import { TransactionStatus, type ITransaction } from '../../domain/transaction/transaction-interface'
import { useTransaction } from '../../shared/utils/transaction/use-transaction'
import { useTransactionAdapter } from '../../shared/utils/transaction/use-transaction-adapter'
import { MockTransactionAdapter } from '../../test/mock/transaction/mock-transaction-adapter'
import type { DataScope } from '../../types/data-context'
import type { ITransactionScope } from '../../types/transaction-context'
import { Transaction } from './transaction'
import { transactionModule } from './transaction-module'
import { wrapWithTransaction } from './wrap-with-transaction'

describe('wrapWithTransaction', () => {
    const setup = () => {
        const adapter = new MockTransactionAdapter()
        const context = new Context<ITransactionScope>()
        context.registerValue('transactionAdapter', adapter)
        return { adapter, context }
    }

    it('runs each call in its own transaction and forwards arguments', async () => {
        const { adapter, context } = setup()
        const seen: ITransaction[] = []

        const add = wrapWithTransaction(async (a: number, b: number) => {
            const transaction = useTransaction()
            expect(transaction.status).toBe(TransactionStatus.Active)
            seen.push(transaction)
            return a + b
        })

        const results = await withContext(context, async () => [await add(1, 2), await add(3, 4)])

        expect(results).toEqual([3, 7])
        expect(seen[0]).not.toBe(seen[1])
        expect(seen.map((transaction) => transaction.status)).toEqual([
            TransactionStatus.Committed,
            TransactionStatus.Committed,
        ])
        expect(adapter.operations.map(({ operation }) => operation)).toEqual(['begin', 'commit', 'begin', 'commit'])
    })

    it('rolls back and rethrows when the wrapped function throws', async () => {
        const { adapter, context } = setup()
        const handler = wrapWithTransaction(async () => {
            throw new Error('handler failed')
        })

        await expect(withContext(context, () => handler())).rejects.toThrow('handler failed')
        expect(adapter.operations.map(({ operation }) => operation)).toEqual(['begin', 'rollback'])
    })

    describe('options', () => {
        it('runs a background task in the app context, which has no stack', async () => {
            const { adapter, context } = setup()
            let seen: ITransaction | undefined

            const processJob = wrapWithTransaction(async (jobId: string) => {
                seen = useTransaction()
                expect(useTransactionAdapter()).toBe(adapter)
                expect(adapter.handle().depth).toBe(0)
                return `processed ${jobId}`
            })

            expect(await withContext(context, () => processJob('job-1'))).toBe('processed job-1')
            expect(seen?.status).toBe(TransactionStatus.Committed)
            expect(adapter.operations.map(({ operation }) => operation)).toEqual(['begin', 'commit'])
        })

        it('rolls back a background task that throws', async () => {
            const { adapter, context } = setup()
            const processJob = wrapWithTransaction(async () => {
                throw new Error('job failed')
            })

            await expect(withContext(context, () => processJob())).rejects.toThrow('job failed')
            expect(adapter.operations.map(({ operation }) => operation)).toEqual(['begin', 'rollback'])
        })

        it('throws when called where no adapter can be found', async () => {
            let hasRun = false
            const processJob = wrapWithTransaction(async () => {
                hasRun = true
            })

            await expect(processJob()).rejects.toThrow('No transaction adapter could be found')
            await expect(withContext(new Context(), () => processJob())).rejects.toThrow(
                'No transaction adapter could be found',
            )
            expect(hasRun).toBe(false)
        })

        it('starts a top-level transaction from inside a run with { parent: null }', async () => {
            const { adapter, context } = setup()
            let inner: ITransaction | undefined

            const independent = wrapWithTransaction(
                async () => {
                    inner = useTransaction()
                },
                { parent: null },
            )

            await withContext(context, () =>
                Transaction.run(async (outer) => {
                    await independent()
                    expect(useTransaction()).toBe(outer)
                }),
            )

            expect(inner?.parent).toBeUndefined()
            expect(inner?.depth).toBe(0)
            expect(adapter.operations.map(({ operation, depth }) => `${operation}@${depth}`)).toEqual([
                'begin@0',
                'begin@0',
                'commit@0',
                'commit@0',
            ])
        })
    })

    describe('in simulated framework middleware', () => {
        let appContext: Context<DataScope>
        let adapter: MockTransactionAdapter

        const operations = () => adapter.operations.map(({ operation, depth }) => `${operation}@${depth}`)
        const newRequestContext = async () =>
            (await createRequestContext(appContext, {
                headers: {},
            } as unknown as Request)) as unknown as Context<DataScope>

        beforeEach(async () => {
            adapter = new MockTransactionAdapter()
            appContext = new Context<DataScope>()
            await appContext.use(useDeclaro(), transactionModule({ adapter }))
        })

        describe('Hono-style (awaitable next)', () => {
            interface HonoContext {
                requestContext: Context
            }
            type HonoNext = () => Promise<void>
            type HonoMiddleware = (c: HonoContext, next: HonoNext) => Promise<void>

            /** Runs middleware the way Hono composes it: each `next()` returns a promise of the rest of the chain. */
            const dispatch = (middlewares: HonoMiddleware[], c: HonoContext, index = 0): Promise<void> =>
                middlewares[index]?.(c, () => dispatch(middlewares, c, index + 1)) ?? Promise.resolve()

            const transactionMiddleware: HonoMiddleware = async (c, next) =>
                withContext(c.requestContext, () => Transaction.run(() => next()))

            it('lets the handler see the transaction and commits after it', async () => {
                const c = { requestContext: await newRequestContext() }
                let seen: ITransaction | undefined

                await dispatch(
                    [
                        transactionMiddleware,
                        async () => {
                            seen = useTransaction()
                            expect(seen.status).toBe(TransactionStatus.Active)
                        },
                    ],
                    c,
                )

                expect(seen?.status).toBe(TransactionStatus.Committed)
                expect(operations()).toEqual(['begin@0', 'commit@0'])
            })

            it('rolls back when the handler throws', async () => {
                const c = { requestContext: await newRequestContext() }
                let seen: ITransaction | undefined

                await expect(
                    dispatch(
                        [
                            transactionMiddleware,
                            async () => {
                                seen = useTransaction()
                                throw new Error('handler failed')
                            },
                        ],
                        c,
                    ),
                ).rejects.toThrow('handler failed')

                expect(seen?.status).toBe(TransactionStatus.RolledBack)
                expect(operations()).toEqual(['begin@0', 'rollback@0'])
            })
        })

        describe('Express-style (synchronous next, response finishes later)', () => {
            interface ExpressRequest {
                requestContext: Context
            }

            /** A minimal stand-in for Node's `ServerResponse`: `finish` when sent, then `close`. */
            class SimulatedResponse extends EventEmitter {
                statusCode = 200
                writableFinished = false
                locals: { transactionSettled?: Promise<void> } = {}

                end() {
                    this.writableFinished = true
                    this.emit('finish')
                    this.emit('close')
                }

                /** Simulates the client disconnecting before the response is sent. */
                destroy() {
                    this.emit('close')
                }
            }

            type ExpressNext = (error?: unknown) => void
            type ExpressMiddleware = (req: ExpressRequest, res: SimulatedResponse, next: ExpressNext) => void

            /** Runs middleware the way Express does: `next()` returns nothing, and an error goes to the error handler. */
            const dispatch = (middlewares: ExpressMiddleware[], req: ExpressRequest, res: SimulatedResponse) => {
                let index = 0
                const next: ExpressNext = (error) => {
                    if (error) {
                        res.statusCode = 500
                        res.end()
                        return
                    }
                    middlewares[index++]?.(req, res, next)
                }
                next()
            }

            const transactionMiddleware: ExpressMiddleware = (req, res, next) => {
                withContext(req.requestContext, async () => {
                    const transaction = await Transaction.begin()
                    let isSettled = false
                    const settle = (shouldCommit: boolean) => {
                        if (isSettled) return
                        isSettled = true
                        res.locals.transactionSettled = shouldCommit
                            ? transaction.commit().catch(() => transaction.rollback())
                            : transaction.rollback()
                    }

                    res.on('finish', () => settle(res.statusCode < 500))
                    res.on('close', () => {
                        if (!res.writableFinished) settle(false)
                    })
                    next()
                }).catch(next)
            }

            /** Dispatches a request and waits until the response has closed and the transaction has settled. */
            const handle = async (handler: ExpressMiddleware) => {
                const req = { requestContext: await newRequestContext() }
                const res = new SimulatedResponse()
                const closed = once(res, 'close')
                dispatch([transactionMiddleware, handler], req, res)
                await closed
                await res.locals.transactionSettled
                return res
            }

            it('lets the handler see the transaction and commits when the response finishes', async () => {
                let seen: ITransaction | undefined

                await handle(async (_req, res) => {
                    seen = useTransaction()
                    await new Promise((resolve) => setTimeout(resolve, 1))
                    expect(useTransaction()).toBe(seen)
                    expect(operations()).toEqual(['begin@0'])
                    res.end()
                })

                expect(seen?.status).toBe(TransactionStatus.Committed)
                expect(operations()).toEqual(['begin@0', 'commit@0'])
            })

            it('rolls back when the handler passes an error to next()', async () => {
                let seen: ITransaction | undefined

                const res = await handle(async (_req, _res, next) => {
                    try {
                        seen = useTransaction()
                        throw new Error('handler failed')
                    } catch (error) {
                        next(error)
                    }
                })

                expect(res.statusCode).toBe(500)
                expect(seen?.status).toBe(TransactionStatus.RolledBack)
                expect(operations()).toEqual(['begin@0', 'rollback@0'])
            })

            it('rolls back a 5xx response', async () => {
                await handle((_req, res) => {
                    res.statusCode = 503
                    res.end()
                })

                expect(operations()).toEqual(['begin@0', 'rollback@0'])
            })

            it('rolls back when the connection closes before the response finishes', async () => {
                await handle((_req, res) => {
                    res.destroy()
                })

                expect(operations()).toEqual(['begin@0', 'rollback@0'])
            })
        })
    })
})
