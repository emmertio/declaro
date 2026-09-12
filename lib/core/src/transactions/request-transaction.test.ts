import { beforeEach, describe, expect, it } from 'bun:test'
import { isSuccessfulResponse, withTransaction, withTransactionScope } from './request-transaction'
import { MockTransactionAdapter } from './test/mock-transaction-adapter'
import { configureTransactions, transaction } from './transaction'
import { TransactionPropagation } from './transaction-adapter'
import type { TransactionManager } from './transaction-manager'
import { TransactionKind } from './transaction-scope'
import { resetTransactionState } from './transaction-session'

type FakeResponse = { status: number; body: string }

describe('withTransaction', () => {
    let adapter: MockTransactionAdapter
    let manager: TransactionManager<any>

    beforeEach(() => {
        resetTransactionState()
        adapter = new MockTransactionAdapter()
        manager = configureTransactions(adapter, { onError: () => {} })
    })

    it('commits the transaction wrapping a successful request', async () => {
        const handler = withTransaction(async (name: string) => {
            adapter.write(transaction.current()!.handle, name)
            return { status: 200, body: name } satisfies FakeResponse
        })

        const response = await handler('order')

        expect(response).toEqual({ status: 200, body: 'order' })
        expect(adapter.store).toEqual(['order'])
    })

    it('rolls back everything the request wrote when it throws', async () => {
        const handler = withTransaction(async () => {
            adapter.write(transaction.current()!.handle, 'partial')
            throw new Error('request failed')
        })

        await expect(handler()).rejects.toThrow('request failed')
        expect(adapter.store).toEqual([])
        expect(adapter.openHandles).toEqual([])
    })

    it('rolls back but still returns the response when shouldCommit is false', async () => {
        const handler = withTransaction(
            async () => {
                adapter.write(transaction.current()!.handle, 'partial')
                return { status: 500, body: 'error' } satisfies FakeResponse
            },
            { shouldCommit: isSuccessfulResponse },
        )

        const response = await handler()

        expect(response).toEqual({ status: 500, body: 'error' })
        expect(adapter.store).toEqual([])
        expect(adapter.log).toEqual(['begin:1', 'write:1:partial', 'rollback:1'])
    })

    it('commits when shouldCommit accepts the response', async () => {
        const handler = withTransaction(
            async () => {
                adapter.write(transaction.current()!.handle, 'created')
                return { status: 201, body: 'created' } satisfies FakeResponse
            },
            { shouldCommit: isSuccessfulResponse },
        )

        await handler()

        expect(adapter.store).toEqual(['created'])
    })

    it('gives every request its own transaction', async () => {
        const handler = withTransaction(async (name: string, shouldFail: boolean) => {
            adapter.write(transaction.current()!.handle, name)
            await Promise.resolve()
            if (shouldFail) throw new Error(`${name} failed`)
            return name
        })

        const results = await Promise.allSettled([handler('first', false), handler('second', true)])

        expect(results[0]).toMatchObject({ status: 'fulfilled', value: 'first' })
        expect(results[1]).toMatchObject({ status: 'rejected' })
        expect(adapter.store).toEqual(['first'])
        expect(adapter.handles).toHaveLength(2)
    })

    it('passes options through to the manager', async () => {
        const handler = withTransaction(async () => 'ok', { isReadOnly: true, manager })

        await handler()

        expect(adapter.handles[0]?.options).toMatchObject({ isReadOnly: true })
    })

    it('nests when the wrapped handler is called inside another transaction', async () => {
        const handler = withTransaction(async () => {
            expect(transaction.current()?.kind).toBe(TransactionKind.SAVEPOINT)
            adapter.write(transaction.current()!.handle, 'nested')
            return 'ok'
        })

        await transaction(async () => {
            await handler()
        })

        expect(adapter.handles).toHaveLength(1)
        expect(adapter.store).toEqual(['nested'])
    })

    it('starts an independent transaction when asked to', async () => {
        const handler = withTransaction(async () => 'ok', {
            propagation: TransactionPropagation.REQUIRES_NEW,
        })

        await transaction(async () => {
            await handler()
        })

        expect(adapter.handles).toHaveLength(2)
    })
})

describe('withTransactionScope', () => {
    let adapter: MockTransactionAdapter

    beforeEach(() => {
        resetTransactionState()
        adapter = new MockTransactionAdapter()
        configureTransactions(adapter, { onError: () => {} })
    })

    it('hands the scope to the handler as its first argument', async () => {
        const handler = withTransactionScope(async (scope, name: string) => {
            adapter.write(scope.handle, name)
            expect(scope).toBe(transaction.current()!)
            return { status: 200, body: name } satisfies FakeResponse
        })

        await handler('order')

        expect(adapter.store).toEqual(['order'])
    })

    it('rolls back but returns the response when shouldCommit is false', async () => {
        const handler = withTransactionScope(
            async (scope) => {
                adapter.write(scope.handle, 'partial')
                return { status: 503, body: 'unavailable' } satisfies FakeResponse
            },
            { shouldCommit: isSuccessfulResponse },
        )

        const response = await handler()

        expect(response.status).toBe(503)
        expect(adapter.store).toEqual([])
    })

    it('rolls back when the handler throws', async () => {
        const handler = withTransactionScope(async (scope) => {
            adapter.write(scope.handle, 'partial')
            throw new Error('handler failed')
        })

        await expect(handler()).rejects.toThrow('handler failed')
        expect(adapter.store).toEqual([])
    })
})

describe('isSuccessfulResponse', () => {
    it('accepts success statuses', () => {
        expect(isSuccessfulResponse({ status: 200 })).toBe(true)
        expect(isSuccessfulResponse({ status: 302 })).toBe(true)
        expect(isSuccessfulResponse(new Response('ok'))).toBe(true)
    })

    it('rejects error statuses', () => {
        expect(isSuccessfulResponse({ status: 400 })).toBe(false)
        expect(isSuccessfulResponse({ status: 500 })).toBe(false)
        expect(isSuccessfulResponse(new Response('nope', { status: 503 }))).toBe(false)
    })

    it('reads node style status codes', () => {
        expect(isSuccessfulResponse({ statusCode: 204 })).toBe(true)
        expect(isSuccessfulResponse({ statusCode: 422 })).toBe(false)
    })

    it('treats results without a status as successful', () => {
        expect(isSuccessfulResponse({ id: 1 })).toBe(true)
        expect(isSuccessfulResponse(undefined)).toBe(true)
        expect(isSuccessfulResponse(null)).toBe(true)
        expect(isSuccessfulResponse('created')).toBe(true)
    })
})
