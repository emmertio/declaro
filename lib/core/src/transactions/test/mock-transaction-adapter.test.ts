import { describe, expect, it } from 'bun:test'
import { hasSavepointSupport } from '../transaction-adapter'
import { MockTransactionAdapter } from './mock-transaction-adapter'

describe('MockTransactionAdapter', () => {
    it('flushes pending writes on commit', () => {
        const adapter = new MockTransactionAdapter()
        const handle = adapter.begin()

        adapter.write(handle, 'first')
        adapter.write(handle, 'second')
        expect(adapter.store).toEqual([])

        adapter.commit(handle)

        expect(adapter.store).toEqual(['first', 'second'])
        expect(handle.isOpen).toBe(false)
    })

    it('discards pending writes on rollback', () => {
        const adapter = new MockTransactionAdapter()
        const handle = adapter.begin()
        adapter.write(handle, 'first')

        adapter.rollback(handle)

        expect(adapter.store).toEqual([])
        expect(adapter.openHandles).toEqual([])
    })

    it('truncates writes back to the savepoint', () => {
        const adapter = new MockTransactionAdapter()
        const handle = adapter.begin()

        adapter.write(handle, 'kept')
        adapter.createSavepoint!(handle, 'sp_1')
        adapter.write(handle, 'discarded')
        adapter.rollbackToSavepoint!(handle, 'sp_1')
        adapter.commit(handle)

        expect(adapter.store).toEqual(['kept'])
    })

    it('keeps writes made before a released savepoint', () => {
        const adapter = new MockTransactionAdapter()
        const handle = adapter.begin()

        adapter.createSavepoint!(handle, 'sp_1')
        adapter.write(handle, 'kept')
        adapter.releaseSavepoint!(handle, 'sp_1')
        adapter.commit(handle)

        expect(adapter.store).toEqual(['kept'])
        expect(handle.savepoints.size).toBe(0)
    })

    it('omits savepoint methods when they are disabled', () => {
        const adapter = new MockTransactionAdapter({ hasSavepoints: false })

        expect(adapter.createSavepoint).toBeUndefined()
        expect(hasSavepointSupport(adapter)).toBe(false)
        expect(hasSavepointSupport(new MockTransactionAdapter())).toBe(true)
    })

    it('refuses writes to a settled transaction', () => {
        const adapter = new MockTransactionAdapter()
        const handle = adapter.begin()
        adapter.commit(handle)

        expect(() => adapter.write(handle, 'late')).toThrow('Cannot write to closed transaction')
    })

    it('simulates adapter failures', () => {
        const adapter = new MockTransactionAdapter()
        adapter.shouldFailBegin = true
        expect(() => adapter.begin()).toThrow('begin failed')

        adapter.shouldFailBegin = false
        const handle = adapter.begin()

        adapter.shouldFailCommit = true
        expect(() => adapter.commit(handle)).toThrow('commit failed')

        adapter.shouldFailRollback = true
        expect(() => adapter.rollback(handle)).toThrow('rollback failed')
        expect(adapter.openHandles).toEqual([handle])
    })

    it('records every operation in order', () => {
        const adapter = new MockTransactionAdapter({ hasRunHook: true })
        const handle = adapter.begin()

        adapter.run!(handle, () => {
            expect(adapter.boundHandle).toBe(handle)
            adapter.write(handle, 'value')
        })
        adapter.commit(handle)

        expect(adapter.log).toEqual(['begin:1', 'run:1', 'write:1:value', 'commit:1'])
        expect(adapter.boundHandle).toBeNull()
    })
})
