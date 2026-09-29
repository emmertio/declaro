import { Context, createRequestContext, useDeclaro, withContext, type Request } from '@declaro/core'
import { beforeEach, describe, expect, it } from 'bun:test'
import type { ITransaction } from '../../domain/transaction/transaction-interface'
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

    it('wraps a request handler in a transaction', async () => {
        const requestContext = await newRequestContext()
        const handler = wrapWithTransaction(async () => {
            throw new Error('handler failed')
        })

        await expect(withContext(requestContext, () => handler())).rejects.toThrow('handler failed')
        expect(operations()).toEqual(['begin@0', 'rollback@0'])
    })
})
