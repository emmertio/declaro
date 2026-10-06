import { Context, withContext } from '@declaro/core'
import { describe, expect, it } from 'bun:test'
import { MockTransactionAdapter } from '../../../test/mock/transaction/mock-transaction-adapter'
import type { ITransactionScope } from '../../../types/transaction-context'
import { useTransactionAdapter } from './use-transaction-adapter'

describe('useTransactionAdapter', () => {
    it('returns the adapter registered on the ambient context', () => {
        const adapter = new MockTransactionAdapter()
        const context = new Context<ITransactionScope>()
        context.registerValue('transactionAdapter', adapter)

        expect(withContext(context, () => useTransactionAdapter())).toBe(adapter)
    })

    it('returns the adapter typed as the requested adapter class', () => {
        const adapter = new MockTransactionAdapter()
        const context = new Context<ITransactionScope>()
        context.registerValue('transactionAdapter', adapter)

        const typed = withContext(context, () => useTransactionAdapter<MockTransactionAdapter>())
        expect(typed.operations).toEqual([])
    })

    it('throws outside of a context', () => {
        expect(() => useTransactionAdapter()).toThrow('useTransactionAdapter() was called outside of an active context')
    })

    it('throws when no adapter is registered', () => {
        expect(() => withContext(new Context(), () => useTransactionAdapter())).toThrow(
            "No transaction adapter was found in the current context. Register one with transactionModule() or context.registerValue('transactionAdapter', ...).",
        )
    })
})
