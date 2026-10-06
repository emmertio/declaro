import { Context, createRequestContext, useDeclaro, withContext, type Request } from '@declaro/core'
import { beforeEach, describe, expect, it } from 'bun:test'
import { TransactionStatus, type ITransaction } from '../../domain/transaction/transaction-interface'
import { useTransaction } from '../../shared/utils/transaction/use-transaction'
import { useTransactionAdapter } from '../../shared/utils/transaction/use-transaction-adapter'
import { MockTransactionAdapter } from '../../test/mock/transaction/mock-transaction-adapter'
import type { DataScope } from '../../types/data-context'
import { Transaction } from './transaction'
import { transactionModule } from './transaction-module'
import { TransactionStack } from './transaction-stack'
import { wrapWithTransaction } from './wrap-with-transaction'

describe('transactionModule', () => {
    let appContext: Context<DataScope>
    let adapter: MockTransactionAdapter

    const request = { headers: {} } as unknown as Request
    const operations = () => adapter.operations.map(({ operation, depth }) => `${operation}@${depth}`)
    const newRequestContext = async () =>
        (await createRequestContext(appContext, request)) as unknown as Context<DataScope>

    beforeEach(async () => {
        adapter = new MockTransactionAdapter()
        appContext = new Context<DataScope>()
        await appContext.use(useDeclaro(), transactionModule({ adapter }))
    })

    it('registers the adapter', () => {
        expect(appContext.resolve('transactionAdapter')).toBe(adapter)
        expect(withContext(appContext, () => useTransactionAdapter())).toBe(adapter)
    })

    it('does not register a transaction stack on the app context', async () => {
        expect(appContext.resolve('transactionStack')).toBeUndefined()
        await expect(withContext(appContext, () => Transaction.begin())).rejects.toThrow(
            'No transaction stack was found',
        )
    })

    it('registers a new transaction stack on each request context', async () => {
        const first = await newRequestContext()
        const second = await newRequestContext()

        expect(first.resolve('transactionStack')).toBeInstanceOf(TransactionStack)
        expect(first.resolve('transactionStack')).not.toBe(second.resolve('transactionStack'))
        expect(() => withContext(first, () => useTransaction())).toThrow('No transaction is active')
    })

    it('keeps the transactions of two requests apart', async () => {
        const first = await newRequestContext()
        const second = await newRequestContext()

        const a = await withContext(first, () => Transaction.begin())
        const b = await withContext(second, () => Transaction.begin())

        expect(b.parent).toBeUndefined()
        expect(withContext(first, () => useTransaction())).toBe(a)
        expect(withContext(second, () => useTransaction())).toBe(b)

        await a.commit()
        expect(() => withContext(first, () => useTransaction())).toThrow('No transaction is active')
        expect(withContext(second, () => useTransaction())).toBe(b)

        await b.commit()
        expect(operations()).toEqual(['begin@0', 'begin@0', 'commit@0', 'commit@0'])
    })

    it('lets app-level code run transactions', async () => {
        await withContext(appContext, () => Transaction.run(async () => {}))

        expect(operations()).toEqual(['begin@0', 'commit@0'])
    })

    it('nests runs in a transaction begun on the request', async () => {
        const requestContext = await newRequestContext()

        await withContext(requestContext, async () => {
            const outer = await Transaction.begin()

            await Transaction.run(async (nested) => {
                expect(nested.parent).toBe(outer)
                expect(useTransactionAdapter()).toBe(adapter)
            })

            expect(useTransaction()).toBe(outer)
            await outer.commit()
        })

        expect(operations()).toEqual(['begin@0', 'begin@1', 'commit@1', 'commit@0'])
    })

    it('makes useTransaction() throw in fire-and-forget work that outlives its transaction', async () => {
        const requestContext = await newRequestContext()
        let late: Promise<ITransaction> | undefined

        await withContext(requestContext, async () => {
            const transaction = await Transaction.begin()
            late = new Promise((resolve) => setTimeout(resolve, 5)).then(() => useTransaction())
            await transaction.commit()
        })

        await expect(late!).rejects.toThrow('No transaction is active in the current context')
    })

    describe('when the context the request is created from has a transaction stack', () => {
        let outerStack: TransactionStack

        beforeEach(() => {
            outerStack = new TransactionStack()
            appContext.registerValue('transactionStack', outerStack)
        })

        it('starts the request nested under its active current transaction', async () => {
            const outer = await Transaction.begin({ context: appContext })
            const requestContext = await newRequestContext()
            const stack = requestContext.resolve('transactionStack')

            expect(stack).not.toBe(outerStack)
            expect(stack.size).toBe(0)
            expect(withContext(requestContext, () => useTransaction())).toBe(outer)

            await withContext(requestContext, async () => {
                const inner = await Transaction.begin()
                expect(inner.parent).toBe(outer)
                expect(useTransaction()).toBe(inner)

                await Transaction.run(async (nested) => {
                    expect(nested.parent).toBe(inner)
                })

                await inner.commit()
                expect(useTransaction()).toBe(outer)
            })

            await outer.rollback()
            expect(() => withContext(requestContext, () => useTransaction())).toThrow('No transaction is active')
            expect(operations()).toEqual(['begin@0', 'begin@1', 'begin@2', 'commit@2', 'commit@1', 'rollback@0'])
        })

        it('cascades a rollback of the outer transaction into what the request left open', async () => {
            const outer = await Transaction.begin({ context: appContext })
            const requestContext = await newRequestContext()
            const leftOpen = await withContext(requestContext, async () => {
                const first = await Transaction.begin()
                await Transaction.begin()
                return first
            })

            await withContext(appContext, () => outer.rollback())

            expect(leftOpen.status).toBe(TransactionStatus.RolledBack)
            expect(requestContext.resolve('transactionStack').size).toBe(0)
            expect(operations()).toEqual(['begin@0', 'begin@1', 'begin@2', 'rollback@2', 'rollback@1', 'rollback@0'])
        })

        it('cascades a commit of the outer transaction into what the request left open', async () => {
            const outer = await Transaction.begin({ context: appContext })
            const requestContext = await newRequestContext()
            const leftOpen = await withContext(requestContext, () => Transaction.begin())

            await outer.commit()

            expect(leftOpen.status).toBe(TransactionStatus.Committed)
            expect(operations()).toEqual(['begin@0', 'begin@1', 'commit@1', 'commit@0'])
        })

        it('cascades into a request created from a request nested under the outer transaction', async () => {
            const outer = await Transaction.begin({ context: appContext })
            const first = await newRequestContext()
            const firstOpen = await withContext(first, () => Transaction.begin())
            const second = (await createRequestContext(first, request)) as unknown as Context<DataScope>
            const secondOpen = await withContext(second, () => Transaction.begin())

            expect(secondOpen.parent).toBe(firstOpen)
            await outer.rollback()

            expect([firstOpen.status, secondOpen.status]).toEqual([
                TransactionStatus.RolledBack,
                TransactionStatus.RolledBack,
            ])
            expect(operations()).toEqual(['begin@0', 'begin@1', 'begin@2', 'rollback@2', 'rollback@1', 'rollback@0'])
        })

        it('gives each request its own stack, and still rejects parallel children of the outer transaction', async () => {
            const outer = await Transaction.begin({ context: appContext })
            const first = await newRequestContext()
            const second = await newRequestContext()

            expect(first.resolve('transactionStack')).not.toBe(second.resolve('transactionStack'))
            const a = await withContext(first, () => Transaction.begin())
            await expect(withContext(second, () => Transaction.begin())).rejects.toThrow(
                'already has an active child in another async flow',
            )

            expect(withContext(second, () => useTransaction())).toBe(outer)
            await a.commit()
            const b = await withContext(second, () => Transaction.begin())
            expect(b.parent).toBe(outer)
            await outer.rollback()
            expect(b.status).toBe(TransactionStatus.RolledBack)
        })

        it('still rejects finishing the outer transaction while a request runs a child in parallel', async () => {
            const outer = await Transaction.begin({ context: appContext })
            const requestContext = await newRequestContext()
            let release!: () => void
            const blocked = new Promise<void>((resolve) => (release = resolve))
            let started!: () => void
            const isStarted = new Promise<void>((resolve) => (started = resolve))

            const running = withContext(requestContext, () =>
                Transaction.run(async () => {
                    started()
                    await blocked
                }),
            )
            await isStarted

            await expect(outer.rollback()).rejects.toThrow('open child transaction(s) in another async flow')
            release()
            await running
            await outer.rollback()
            expect(operations()).toEqual(['begin@0', 'begin@1', 'commit@1', 'rollback@0'])
        })

        it('starts the request with an empty stack when the outer stack has no active transaction', async () => {
            const finished = await Transaction.begin({ context: appContext })
            await finished.commit()

            const requestContext = await newRequestContext()

            expect(requestContext.resolve('transactionStack')).not.toBe(outerStack)
            expect(() => withContext(requestContext, () => useTransaction())).toThrow('No transaction is active')
            const transaction = await withContext(requestContext, () => Transaction.begin())
            expect(transaction.parent).toBeUndefined()
            await transaction.commit()
            expect(operations()).toEqual(['begin@0', 'commit@0', 'begin@0', 'commit@0'])
        })
    })

    it('wraps a request handler in a transaction', async () => {
        const requestContext = await newRequestContext()
        const handler = wrapWithTransaction(async () => {
            throw new Error('handler failed')
        })

        await expect(withContext(requestContext, () => handler())).rejects.toThrow('handler failed')
        expect(operations()).toEqual(['begin@0', 'rollback@0'])
    })
})
