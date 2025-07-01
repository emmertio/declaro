import { describe, it, expect } from 'bun:test'
import { QueryEvent } from './query-event'

describe('QueryEvent', () => {
    describe('load action', () => {
        it('should lookup a book with the given lookup', () => {
            const params = { id: 42 }
            const descriptor = { namespace: 'books', action: 'load' }
            const query = new QueryEvent(descriptor, params, {})

            expect(query.descriptor.namespace).toBe('books')
            expect(query.descriptor.action).toBe('load')
            expect(query.meta.input).toEqual(params)
        })
    })

    describe('search action', () => {
        it('should search for books with the given filters', () => {
            const params = { text: '1984' }
            const descriptor = { namespace: 'books', action: 'search' }
            const query = new QueryEvent(descriptor, params, {})

            expect(query.descriptor.namespace).toBe('books')
            expect(query.descriptor.action).toBe('search')
            expect(query.meta.input).toEqual(params)
        })
    })
})
