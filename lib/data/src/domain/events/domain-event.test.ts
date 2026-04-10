import { describe, expect, it } from 'bun:test'
import { DomainEvent } from './domain-event'
import type { IDomainEventOptions } from './domain-event'

interface Book {
    title: string
    author: string
}

class MyEvent extends DomainEvent<Book> {
    type = 'BOOK_CREATED' as const

    constructor(options: IDomainEventOptions<Book>) {
        super(options)
    }
}

describe('DomainEvent', () => {
    it('should create a domain event with default values', () => {
        const book: Book = { title: '1984', author: 'George Orwell' }
        const event = new MyEvent({ data: book })

        expect(event.eventId?.length).toBeGreaterThanOrEqual(36) // UUID length
        expect(event.data).toEqual(book)
        expect(event.timestamp).toBeInstanceOf(Date)
        expect(event.type).toBe('BOOK_CREATED')
        expect(event.session).toBeUndefined() // session is optional and not set by default
        expect(event.meta).toEqual({}) // meta should default to an empty object
    })

    it('should create a domain event with metadata', () => {
        const book: Book = { title: '1984', author: 'George Orwell' }
        const event = new MyEvent({ data: book, meta: { createdBy: 'user123' } })

        expect(event.meta).toEqual({ createdBy: 'user123' })
    })

    it('should default timestamp to the current time', () => {
        const book: Book = { title: '1984', author: 'George Orwell' }
        const event = new MyEvent({ data: book })

        const now = new Date()
        expect(event.timestamp.getTime()).toBeLessThanOrEqual(now.getTime())
        expect(event.timestamp.getTime()).toBeGreaterThanOrEqual(now.getTime() - 1000) // Allow 1 second margin
    })

    it('should instantiate with no input', () => {
        const event = new DomainEvent()

        expect(event.eventId).toBeDefined()
        expect(event.timestamp).toBeInstanceOf(Date)
        expect(event.type).toBe('UNKNOWN_EVENT')
        expect(event.data).toBeUndefined()
        expect(event.meta).toEqual({})
        expect(event.session).toBeUndefined()
    })

    it('should create an event with a descriptor but no type', () => {
        const book: Book = { title: '1984', author: 'George Orwell' }
        const event = new DomainEvent({
            data: book,
            descriptor: { namespace: 'auth', resource: 'user', action: 'create', scope: 'admin' },
        })

        expect(event.type).toBe('auth::user.create:admin')
        expect(event.descriptor.namespace).toBe('auth')
        expect(event.descriptor.resource).toBe('user')
        expect(event.descriptor.action).toBe('create')
        expect(event.descriptor.scope).toBe('admin')
    })

    it('should create an event with a type but no descriptor', () => {
        const book: Book = { title: '1984', author: 'George Orwell' }
        const event = new DomainEvent({ data: book, meta: {}, type: 'books::book.create:own' })

        expect(event.type).toBe('books::book.create:own')
        expect(event.descriptor.namespace).toBe('books')
        expect(event.descriptor.resource).toBe('book')
        expect(event.descriptor.action).toBe('create')
        expect(event.descriptor.scope).toBe('own')
    })
})
