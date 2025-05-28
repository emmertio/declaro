import { describe, expect, it } from 'bun:test'
import { EntityEvent } from './entity-event'
import { EntityEventType } from './entity-event-type'

describe('EntityEvent', () => {
    class Book {
        title: string
        year: number
    }

    it('should set and get entity', () => {
        const event = new EntityEvent<Book>(EntityEventType.Update)
        const book = new Book()
        book.title = '1984'
        book.year = 1949

        event.set(book)

        expect(event.entity).toBe(book)
    })

    it('should patch entity', () => {
        const event = new EntityEvent<Book>(EntityEventType.Update)
        const book = new Book()
        book.title = '1984'
        book.year = 1949

        event.set(book)
        event.patch({ title: 'Animal Farm' })

        expect(event.entity?.title).toBe('Animal Farm')
        expect(event.entity?.year).toBe(1949)
    })
})
