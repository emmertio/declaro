import { describe, it, expect } from 'bun:test'
import { QueryEvent } from './query-event'
import { ActionDescriptor, type IActionDescriptorInput } from '@declaro/core'

interface IBookResult {
    id: string
    title: string
    description: string
    author: string
    year: number
}

interface ILoadParams {
    id: string
}

interface ISearchParams {
    text?: string
    author?: string
    year?: number
}

describe('QueryEvent', () => {
    it('should create a query event with params and descriptor', () => {
        const params: ILoadParams = { id: '1' }
        const descriptor: IActionDescriptorInput = { namespace: 'books', resource: 'book', action: 'load' }
        const event = new QueryEvent<IBookResult, ILoadParams>(descriptor, params)

        expect(event.input).toEqual(params)
        expect(event.descriptor.toString()).toEqual(new ActionDescriptor(descriptor).toString())
        expect(event.meta).toEqual({})
        expect(event.data).toBeUndefined()
    })

    it('should set result correctly', () => {
        const params: ILoadParams = { id: '1' }
        const descriptor: IActionDescriptorInput = { namespace: 'books', resource: 'book', action: 'load' }
        const event = new QueryEvent<IBookResult, ILoadParams>(descriptor, params)

        expect(event.data).toBeUndefined()

        const result: IBookResult = {
            id: '1',
            title: 'Test Book',
            description: 'A book for testing',
            author: 'Author Name',
            year: 2024,
        }
        event.setResult(result)

        expect(event.data).toEqual(result)
    })

    it('should update meta correctly', () => {
        const params: ISearchParams = { text: '1984' }
        const descriptor: IActionDescriptorInput = { namespace: 'books', resource: 'book', action: 'search' }
        const event = new QueryEvent<IBookResult[], ISearchParams>(descriptor, params)

        event.setMeta({ customField: 'custom value' })

        expect(event.meta.customField).toBe('custom value')
    })

    it('should serialize to JSON with eventId and timestamp', () => {
        const params: ILoadParams = { id: '1' }
        const descriptor: IActionDescriptorInput = { namespace: 'books', resource: 'book', action: 'load' }
        const event = new QueryEvent<IBookResult, ILoadParams>(descriptor, params)

        const result: IBookResult = {
            id: '1',
            title: 'Test Book',
            description: 'A book for testing',
            author: 'Author Name',
            year: 2024,
        }
        event.setResult(result)

        const json = event.toJSON()

        expect(json.eventId).toBeDefined()
        expect(json.timestamp).toBeDefined()
        expect(json.type).toBe('books::book.load')
        expect(json.input).toEqual(params)
        expect(json.data).toEqual(result)
    })

    it('should handle chaining of setter methods', () => {
        const params: ILoadParams = { id: '1' }
        const result: IBookResult = {
            id: '1',
            title: 'Test Book',
            description: 'A book for testing',
            author: 'Author Name',
            year: 2024,
        }

        const descriptor: IActionDescriptorInput = { namespace: 'books', resource: 'book', action: 'load' }
        const event = new QueryEvent<IBookResult, ILoadParams>(descriptor, params)
            .setMeta({ customField: 'value' })
            .setResult(result)

        expect(event.input).toEqual(params)
        expect(event.meta.customField).toBe('value')
        expect(event.data).toEqual(result)
    })

    it('should update input after initialization', () => {
        const params: ISearchParams = { text: '1984' }
        const descriptor: IActionDescriptorInput = { namespace: 'books', resource: 'book', action: 'search' }
        const event = new QueryEvent<IBookResult[], ISearchParams>(descriptor, params)

        const newParams: ISearchParams = {
            text: 'Brave New World',
            author: 'Aldous Huxley',
        }
        event.setInput(newParams)

        expect(event.input).toEqual(newParams)
    })

    it('should maintain type throughout lifecycle', () => {
        const params: ILoadParams = { id: '1' }
        const descriptor: IActionDescriptorInput = { namespace: 'books', resource: 'book', action: 'load' }
        const event = new QueryEvent<IBookResult, ILoadParams>(descriptor, params)

        expect(event.type).toBe('books::book.load')

        event.setInput({ id: '2' })
        expect(event.type).toBe('books::book.load')

        const result: IBookResult = {
            id: '2',
            title: 'Another Book',
            description: 'Another description',
            author: 'Another Author',
            year: 2025,
        }
        event.setResult(result)
        expect(event.type).toBe('books::book.load')
    })

    it('should handle search action with multiple filters', () => {
        const params: ISearchParams = {
            text: 'science fiction',
            author: 'Isaac Asimov',
            year: 1950,
        }
        const descriptor: IActionDescriptorInput = { namespace: 'books', resource: 'book', action: 'search' }
        const event = new QueryEvent<IBookResult[], ISearchParams>(descriptor, params)

        expect(event.descriptor.action).toBe('search')
        expect(event.input).toEqual(params)
    })

    it('should handle search results as array', () => {
        const params: ISearchParams = { text: 'Foundation' }
        const descriptor: IActionDescriptorInput = { namespace: 'books', resource: 'book', action: 'search' }
        const event = new QueryEvent<IBookResult[], ISearchParams>(descriptor, params)

        const results: IBookResult[] = [
            {
                id: '1',
                title: 'Foundation',
                description: 'First book',
                author: 'Isaac Asimov',
                year: 1951,
            },
            {
                id: '2',
                title: 'Foundation and Empire',
                description: 'Second book',
                author: 'Isaac Asimov',
                year: 1952,
            },
        ]
        event.setResult(results)

        expect(event.data).toEqual(results)
        expect(event.data?.length).toBe(2)
    })

    it('should handle load action with single result', () => {
        const params: ILoadParams = { id: '42' }
        const descriptor: IActionDescriptorInput = { namespace: 'books', resource: 'book', action: 'load' }
        const event = new QueryEvent<IBookResult, ILoadParams>(descriptor, params)

        const result: IBookResult = {
            id: '42',
            title: 'The Hitchhiker\'s Guide to the Galaxy',
            description: 'Don\'t Panic',
            author: 'Douglas Adams',
            year: 1979,
        }
        event.setResult(result)

        expect(event.data).toEqual(result)
        expect(event.descriptor.action).toBe('load')
    })

    it('should serialize meta to JSON', () => {
        const params: ISearchParams = { text: 'test' }
        const descriptor: IActionDescriptorInput = { namespace: 'books', resource: 'book', action: 'search' }
        const event = new QueryEvent<IBookResult[], ISearchParams>(descriptor, params, {
            customField: 'custom value',
            anotherField: 123,
        })

        const json = event.toJSON()

        expect(json.meta.customField).toBe('custom value')
        expect(json.meta.anotherField).toBe(123)
        expect(json.input).toEqual(params)
    })

    it('should handle empty search params', () => {
        const params: ISearchParams = {}
        const descriptor: IActionDescriptorInput = { namespace: 'books', resource: 'book', action: 'search' }
        const event = new QueryEvent<IBookResult[], ISearchParams>(descriptor, params)

        expect(event.input).toEqual({})
        expect(event.descriptor.action).toBe('search')
    })
})
