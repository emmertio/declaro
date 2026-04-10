import { describe, it, expect } from 'bun:test'
import { MutationEvent } from './mutation-event'
import { ActionDescriptor, type IActionDescriptorInput } from '@declaro/core'

interface IBookResult {
    id: string
    title: string
    description: string
    author: string
    year: number
}

interface IBookInput {
    title: string
    description: string
    author: string
    year: number
}

describe('MutationEvent', () => {
    it('should create a mutation event with input and descriptor', () => {
        const input: IBookInput = {
            title: 'Test Book',
            description: 'A book for testing',
            author: 'Author Name',
            year: 2024,
        }
        const descriptor: IActionDescriptorInput = { namespace: 'books', resource: 'book', action: 'create' }
        const event = new MutationEvent<IBookResult, IBookInput>(descriptor, input)

        expect(event.input).toEqual(input)
        expect(event.descriptor.toString()).toEqual(new ActionDescriptor(descriptor).toString())
        expect(event.meta).toEqual({})
        expect(event.data).toBeUndefined()
    })

    it('should allow setting existing result in meta', () => {
        const input: IBookInput = {
            title: 'Test Book',
            description: 'A book for testing',
            author: 'Author Name',
            year: 2024,
        }
        const existing: IBookResult = {
            id: '1',
            title: 'Old Title',
            description: 'Old Description',
            author: 'Old Author',
            year: 2000,
        }

        const descriptor: IActionDescriptorInput = { namespace: 'books', resource: 'book', action: 'update' }
        const event = new MutationEvent<IBookResult, IBookInput>(descriptor, input, {
            existing,
        })

        expect(event.input).toEqual(input)
        expect(event.meta.existing).toEqual(existing)
    })

    it('should update meta correctly', () => {
        const input: IBookInput = {
            title: 'Test Book',
            description: 'A book for testing',
            author: 'Author Name',
            year: 2024,
        }

        const descriptor: IActionDescriptorInput = { namespace: 'books', resource: 'book', action: 'create' }
        const event = new MutationEvent<IBookResult, IBookInput>(descriptor, input)

        const existing: IBookResult = {
            id: '1',
            title: 'Old Title',
            description: 'Old Description',
            author: 'Old Author',
            year: 2000,
        }

        event.setMeta({
            existing,
        })

        expect(event.meta.existing).toEqual(existing)
    })

    it('should set result correctly', () => {
        const input: IBookInput = {
            title: 'Test Book',
            description: 'A book for testing',
            author: 'Author Name',
            year: 2024,
        }
        const descriptor: IActionDescriptorInput = { namespace: 'books', resource: 'book', action: 'create' }
        const event = new MutationEvent<IBookResult, IBookInput>(descriptor, input)

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

    it('should serialize to JSON with eventId and timestamp', () => {
        const input: IBookInput = {
            title: 'Test Book',
            description: 'A book for testing',
            author: 'Author Name',
            year: 2024,
        }
        const descriptor: IActionDescriptorInput = { namespace: 'books', resource: 'book', action: 'create' }
        const event = new MutationEvent<IBookResult, IBookInput>(descriptor, input)

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
        expect(json.type).toBe('books::book.create')
        expect(json.input).toEqual(input)
        expect(json.data).toEqual(result)
    })

    it('should handle chaining of setter methods', () => {
        const input: IBookInput = {
            title: 'Test Book',
            description: 'A book for testing',
            author: 'Author Name',
            year: 2024,
        }
        const existing: IBookResult = {
            id: '1',
            title: 'Old Title',
            description: 'Old Description',
            author: 'Old Author',
            year: 2000,
        }
        const result: IBookResult = {
            id: '1',
            title: 'Test Book',
            description: 'A book for testing',
            author: 'Author Name',
            year: 2024,
        }

        const descriptor: IActionDescriptorInput = { namespace: 'books', resource: 'book', action: 'update' }
        const event = new MutationEvent<IBookResult, IBookInput>(descriptor, input)
            .setMeta({ existing })
            .setResult(result)

        expect(event.input).toEqual(input)
        expect(event.meta.existing).toEqual(existing)
        expect(event.data).toEqual(result)
    })

    it('should update input after initialization', () => {
        const input: IBookInput = {
            title: 'Test Book',
            description: 'A book for testing',
            author: 'Author Name',
            year: 2024,
        }
        const descriptor: IActionDescriptorInput = { namespace: 'books', resource: 'book', action: 'create' }
        const event = new MutationEvent<IBookResult, IBookInput>(descriptor, input)

        const newInput: IBookInput = {
            title: 'Updated Book',
            description: 'Updated description',
            author: 'New Author',
            year: 2025,
        }
        event.setInput(newInput)

        expect(event.input).toEqual(newInput)
    })

    it('should allow setting input multiple times', () => {
        const input: IBookInput = {
            title: 'First Book',
            description: 'First description',
            author: 'First Author',
            year: 2024,
        }
        const descriptor: IActionDescriptorInput = { namespace: 'books', resource: 'book', action: 'create' }
        const event = new MutationEvent<IBookResult, IBookInput>(descriptor, input)

        const secondInput: IBookInput = {
            title: 'Second Book',
            description: 'Second description',
            author: 'Second Author',
            year: 2025,
        }
        event.setInput(secondInput)
        expect(event.input).toEqual(secondInput)

        const thirdInput: IBookInput = {
            title: 'Third Book',
            description: 'Third description',
            author: 'Third Author',
            year: 2026,
        }
        event.setInput(thirdInput)
        expect(event.input).toEqual(thirdInput)
    })

    it('should return this from setInput for chaining', () => {
        const input: IBookInput = {
            title: 'Test Book',
            description: 'A book for testing',
            author: 'Author Name',
            year: 2024,
        }
        const descriptor: IActionDescriptorInput = { namespace: 'books', resource: 'book', action: 'create' }
        const event = new MutationEvent<IBookResult, IBookInput>(descriptor, input)

        const newInput: IBookInput = {
            title: 'Updated Book',
            description: 'Updated description',
            author: 'New Author',
            year: 2025,
        }
        const result: IBookResult = {
            id: '1',
            ...newInput,
        }

        const returned = event.setInput(newInput).setResult(result)

        expect(returned).toBe(event)
        expect(event.input).toEqual(newInput)
        expect(event.data).toEqual(result)
    })

    it('should replace entire input object when using setInput', () => {
        const input: IBookInput = {
            title: 'Original Book',
            description: 'Original description',
            author: 'Original Author',
            year: 2024,
        }
        const descriptor: IActionDescriptorInput = { namespace: 'books', resource: 'book', action: 'update' }
        const event = new MutationEvent<IBookResult, IBookInput>(descriptor, input)

        expect(event.input.title).toBe('Original Book')

        const partialInput: IBookInput = {
            title: 'New Title',
            description: 'New description',
            author: 'New Author',
            year: 2025,
        }
        event.setInput(partialInput)

        expect(event.input).toEqual(partialInput)
        expect(event.input.title).toBe('New Title')
        expect(event.input.year).toBe(2025)
    })

    it('should update existing in meta', () => {
        const input: IBookInput = {
            title: 'Test Book',
            description: 'A book for testing',
            author: 'Author Name',
            year: 2024,
        }
        const existing: IBookResult = {
            id: '1',
            title: 'Old Title',
            description: 'Old Description',
            author: 'Old Author',
            year: 2000,
        }
        const descriptor: IActionDescriptorInput = { namespace: 'books', resource: 'book', action: 'update' }
        const event = new MutationEvent<IBookResult, IBookInput>(descriptor, input, { existing })

        const newExisting: IBookResult = {
            id: '1',
            title: 'Different Title',
            description: 'Different Description',
            author: 'Different Author',
            year: 2010,
        }
        event.setMeta({ existing: newExisting })

        expect(event.meta.existing).toEqual(newExisting)
    })

    it('should handle delete action with existing record', () => {
        const input = { id: '1' }
        const existing: IBookResult = {
            id: '1',
            title: 'Book to Delete',
            description: 'This will be deleted',
            author: 'Some Author',
            year: 2020,
        }
        const descriptor: IActionDescriptorInput = { namespace: 'books', resource: 'book', action: 'delete' }
        const event = new MutationEvent<IBookResult, { id: string }>(descriptor, input, { existing })

        expect(event.descriptor.action).toBe('delete')
        expect(event.meta.existing).toEqual(existing)
        expect(event.input).toEqual(input)
    })

    it('should maintain type throughout lifecycle', () => {
        const input: IBookInput = {
            title: 'Test Book',
            description: 'A book for testing',
            author: 'Author Name',
            year: 2024,
        }
        const descriptor: IActionDescriptorInput = { namespace: 'books', resource: 'book', action: 'create' }
        const event = new MutationEvent<IBookResult, IBookInput>(descriptor, input)

        expect(event.type).toBe('books::book.create')

        event.setInput({ ...input, title: 'Updated' })
        expect(event.type).toBe('books::book.create')

        const result: IBookResult = {
            id: '1',
            title: 'Updated',
            description: 'A book for testing',
            author: 'Author Name',
            year: 2024,
        }
        event.setResult(result)
        expect(event.type).toBe('books::book.create')
    })

    it('should serialize existing to JSON for update action', () => {
        const input: IBookInput = {
            title: 'Updated Title',
            description: 'Updated description',
            author: 'Author Name',
            year: 2024,
        }
        const existing: IBookResult = {
            id: '1',
            title: 'Old Title',
            description: 'Old Description',
            author: 'Old Author',
            year: 2020,
        }
        const descriptor: IActionDescriptorInput = { namespace: 'books', resource: 'book', action: 'update' }
        const event = new MutationEvent<IBookResult, IBookInput>(descriptor, input, { existing })

        const json = event.toJSON()

        expect(json.meta.existing).toEqual(existing)
        expect(json.input).toEqual(input)
    })

    it('should handle create action without existing', () => {
        const input: IBookInput = {
            title: 'New Book',
            description: 'Brand new',
            author: 'New Author',
            year: 2024,
        }
        const descriptor: IActionDescriptorInput = { namespace: 'books', resource: 'book', action: 'create' }
        const event = new MutationEvent<IBookResult, IBookInput>(descriptor, input)

        expect(event.meta.existing).toBeUndefined()
        expect(event.descriptor.action).toBe('create')

        const result: IBookResult = {
            id: '1',
            ...input,
        }
        event.setResult(result)

        expect(event.data).toEqual(result)
    })
})
