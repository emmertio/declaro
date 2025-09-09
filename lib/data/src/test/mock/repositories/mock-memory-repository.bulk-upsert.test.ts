import { beforeEach, describe, expect, it } from 'bun:test'
import { MockBookSchema } from '../models/mock-book-models'
import { MockMemoryRepository } from './mock-memory-repository'

describe('MockMemoryRepository - Bulk Upsert Functionality', () => {
    const mockSchema = MockBookSchema

    let repository: MockMemoryRepository<typeof mockSchema>

    beforeEach(() => {
        repository = new MockMemoryRepository({ schema: mockSchema })
    })

    it('should upsert multiple new items', async () => {
        const inputs = [
            { id: 1, title: 'Book 1', author: 'Author 1', publishedDate: new Date('2023-01-01') },
            { id: 2, title: 'Book 2', author: 'Author 2', publishedDate: new Date('2023-02-01') },
            { id: 3, title: 'Book 3', author: 'Author 3', publishedDate: new Date('2023-03-01') },
        ]

        const upsertedItems = await repository.bulkUpsert(inputs)

        expect(upsertedItems).toHaveLength(3)
        expect(upsertedItems).toEqual(inputs)

        // Verify all items were created
        for (const input of inputs) {
            expect(await repository.load({ id: input.id })).toEqual(input)
        }
    })

    it('should update existing items and create new ones in same operation', async () => {
        // Create some initial items
        const existing1 = {
            id: 1,
            title: 'Original Book 1',
            author: 'Original Author 1',
            publishedDate: new Date('2023-01-01'),
        }
        const existing2 = {
            id: 2,
            title: 'Original Book 2',
            author: 'Original Author 2',
            publishedDate: new Date('2023-02-01'),
        }
        await repository.create(existing1)
        await repository.create(existing2)

        // Bulk upsert with mix of updates and new items
        const upsertInputs = [
            { id: 1, title: 'Updated Book 1', author: 'Updated Author 1', publishedDate: new Date('2023-06-01') }, // Update
            { id: 2, title: 'Updated Book 2', author: 'Updated Author 2', publishedDate: new Date('2023-07-01') }, // Update
            { id: 3, title: 'New Book 3', author: 'New Author 3', publishedDate: new Date('2023-08-01') }, // Create
            { id: 4, title: 'New Book 4', author: 'New Author 4', publishedDate: new Date('2023-09-01') }, // Create
        ]

        const upsertedItems = await repository.bulkUpsert(upsertInputs)

        expect(upsertedItems).toHaveLength(4)
        expect(upsertedItems).toEqual(upsertInputs)

        // Verify all items have the updated/new values
        for (const input of upsertInputs) {
            expect(await repository.load({ id: input.id })).toEqual(input)
        }
    })

    it('should handle bulk upsert with items without primary keys', async () => {
        const inputs = [
            { title: 'Book Without ID 1', author: 'Author 1', publishedDate: new Date() },
            { title: 'Book Without ID 2', author: 'Author 2', publishedDate: new Date() },
            { title: 'Book Without ID 3', author: 'Author 3', publishedDate: new Date() },
        ]

        const upsertedItems = await repository.bulkUpsert(inputs)

        expect(upsertedItems).toHaveLength(3)

        // All items should have generated IDs
        expect(upsertedItems[0].id).toBe(1)
        expect(upsertedItems[1].id).toBe(2)
        expect(upsertedItems[2].id).toBe(3)

        // Verify content is preserved
        for (let i = 0; i < inputs.length; i++) {
            expect(upsertedItems[i].title).toBe(inputs[i].title)
            expect(upsertedItems[i].author).toBe(inputs[i].author)
            expect(await repository.load({ id: upsertedItems[i].id })).toEqual(upsertedItems[i])
        }
    })

    it('should handle empty bulk upsert', async () => {
        const upsertedItems = await repository.bulkUpsert([])

        expect(upsertedItems).toEqual([])
    })

    it('should handle bulk upsert with partial updates', async () => {
        // Create initial items
        const initial1 = {
            id: 1,
            title: 'Original Book 1',
            author: 'Original Author 1',
            publishedDate: new Date('2023-01-01'),
        }
        const initial2 = {
            id: 2,
            title: 'Original Book 2',
            author: 'Original Author 2',
            publishedDate: new Date('2023-02-01'),
        }
        await repository.create(initial1)
        await repository.create(initial2)

        // Updates with all required fields but only changing title
        const partialUpdates = [
            { id: 1, title: 'Updated Title 1', author: 'Original Author 1', publishedDate: new Date('2023-01-01') },
            { id: 2, title: 'Updated Title 2', author: 'Original Author 2', publishedDate: new Date('2023-02-01') },
        ]

        const upsertedItems = await repository.bulkUpsert(partialUpdates)

        expect(upsertedItems).toHaveLength(2)

        // Should have updated titles but kept other properties
        expect(upsertedItems[0].title).toBe('Updated Title 1')
        expect(upsertedItems[0].author).toBe('Original Author 1')
        expect(upsertedItems[0].publishedDate).toEqual(initial1.publishedDate)

        expect(upsertedItems[1].title).toBe('Updated Title 2')
        expect(upsertedItems[1].author).toBe('Original Author 2')
        expect(upsertedItems[1].publishedDate).toEqual(initial2.publishedDate)
    })

    it('should handle large bulk operations efficiently', async () => {
        // Create a large number of items to test performance
        const inputs: Array<{ id: number; title: string; author: string; publishedDate: Date }> = []
        for (let i = 1; i <= 100; i++) {
            inputs.push({
                id: i,
                title: `Book ${i}`,
                author: `Author ${i}`,
                publishedDate: new Date(`2023-${String((i % 12) + 1).padStart(2, '0')}-01`),
            })
        }

        const startTime = Date.now()
        const upsertedItems = await repository.bulkUpsert(inputs)
        const endTime = Date.now()

        expect(upsertedItems).toHaveLength(100)
        expect(endTime - startTime).toBeLessThan(1000) // Should complete in under 1 second

        // Verify a few random items
        expect(await repository.load({ id: 1 })).toEqual(inputs[0])
        expect(await repository.load({ id: 50 })).toEqual(inputs[49])
        expect(await repository.load({ id: 100 })).toEqual(inputs[99])
    })
})
