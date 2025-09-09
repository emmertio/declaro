import { beforeEach, describe, expect, it } from 'bun:test'
import { MockBookSchema } from '../models/mock-book-models'
import { MockMemoryRepository } from './mock-memory-repository'

describe('MockMemoryRepository - Upsert Functionality', () => {
    const mockSchema = MockBookSchema

    let repository: MockMemoryRepository<typeof mockSchema>

    beforeEach(() => {
        repository = new MockMemoryRepository({ schema: mockSchema })
    })

    it('should create a new item when no existing item with primary key exists', async () => {
        const input = { id: 42, title: 'New Book', author: 'Author Name', publishedDate: new Date() }

        const upsertedItem = await repository.upsert(input)

        expect(upsertedItem).toEqual(input)
        expect(await repository.load({ id: 42 })).toEqual(input)
    })

    it('should update an existing item when primary key matches', async () => {
        // Create initial item
        const initial = {
            id: 42,
            title: 'Original Book',
            author: 'Original Author',
            publishedDate: new Date('2023-01-01'),
        }
        await repository.create(initial)

        // Upsert with same ID but different data
        const update = {
            id: 42,
            title: 'Updated Book',
            author: 'Updated Author',
            publishedDate: new Date('2023-12-01'),
        }
        const upsertedItem = await repository.upsert(update)

        expect(upsertedItem).toEqual(update)
        expect(await repository.load({ id: 42 })).toEqual(update)
    })

    it('should generate primary key when upserting without one', async () => {
        const input = { title: 'Book Without ID', author: 'Author Name', publishedDate: new Date() }

        const upsertedItem = await repository.upsert(input)

        expect(upsertedItem.id).toBeDefined()
        expect(upsertedItem.title).toBe(input.title)
        expect(upsertedItem.author).toBe(input.author)
        expect(await repository.load({ id: upsertedItem.id })).toEqual(upsertedItem)
    })

    it('should merge with existing item properties when updating', async () => {
        // Create initial item with multiple properties
        const initial = {
            id: 42,
            title: 'Original Book',
            author: 'Original Author',
            publishedDate: new Date('2023-01-01'),
        }
        await repository.create(initial)

        // Upsert with partial update (only title) - need to provide required fields
        const partialUpdate = {
            id: 42,
            title: 'Updated Title',
            author: 'Original Author', // Keep original
            publishedDate: new Date('2023-01-01'), // Keep original
        }
        const upsertedItem = await repository.upsert(partialUpdate)

        // Should have updated title but kept other properties
        expect(upsertedItem.id).toBe(42)
        expect(upsertedItem.title).toBe('Updated Title')
        expect(upsertedItem.author).toBe('Original Author')
        expect(upsertedItem.publishedDate).toEqual(initial.publishedDate)
    })

    it('should handle upsert with null/undefined primary key', async () => {
        const input = {
            id: undefined,
            title: 'Book With Undefined ID',
            author: 'Author Name',
            publishedDate: new Date(),
        }

        const upsertedItem = await repository.upsert(input)

        expect(upsertedItem.id).toBeDefined()
        expect(typeof upsertedItem.id).toBe('number')
        expect(upsertedItem.title).toBe(input.title)
    })

    it('should increment auto-generated IDs correctly', async () => {
        const input1 = { title: 'Book 1', author: 'Author 1', publishedDate: new Date() }
        const input2 = { title: 'Book 2', author: 'Author 2', publishedDate: new Date() }

        const item1 = await repository.upsert(input1)
        const item2 = await repository.upsert(input2)

        expect(item1.id).toBe(1)
        expect(item2.id).toBe(2)
    })
})
