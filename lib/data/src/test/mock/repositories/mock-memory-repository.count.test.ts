import { beforeEach, describe, expect, it } from 'bun:test'
import { MockBookSchema } from '../models/mock-book-models'
import { MockMemoryRepository } from './mock-memory-repository'

describe('MockMemoryRepository - Count Functionality', () => {
    const mockSchema = MockBookSchema

    let repository: MockMemoryRepository<typeof mockSchema>

    beforeEach(() => {
        repository = new MockMemoryRepository({ schema: mockSchema })
    })

    it('should count all items when no filter is provided', async () => {
        // Create test data
        await repository.create({ title: 'Book 1', author: 'Author 1', publishedDate: new Date() })
        await repository.create({ title: 'Book 2', author: 'Author 2', publishedDate: new Date() })
        await repository.create({ title: 'Book 3', author: 'Author 3', publishedDate: new Date() })

        const count = await repository.count({})
        expect(count).toBe(3)
    })

    it('should count filtered items when filter function is provided', async () => {
        const repositoryWithFilter = new MockMemoryRepository({
            schema: mockSchema,
            filter: (data, filters) => {
                if (filters.text) {
                    return data.title.toLowerCase().includes(filters.text.toLowerCase())
                }
                return true
            },
        })

        // Create test data
        await repositoryWithFilter.create({ title: 'Test Book A', author: 'Author 1', publishedDate: new Date() })
        await repositoryWithFilter.create({ title: 'Test Book B', author: 'Author 2', publishedDate: new Date() })
        await repositoryWithFilter.create({ title: 'Other Book', author: 'Author 3', publishedDate: new Date() })
        await repositoryWithFilter.create({ title: 'Another Book', author: 'Author 4', publishedDate: new Date() })

        // Count all items
        const totalCount = await repositoryWithFilter.count({})
        expect(totalCount).toBe(4)

        // Count filtered items
        const filteredCount = await repositoryWithFilter.count({ text: 'Test' })
        expect(filteredCount).toBe(2)

        // Count with no matches
        const noMatchCount = await repositoryWithFilter.count({ text: 'Ruby' })
        expect(noMatchCount).toBe(0)
    })

    it('should count items correctly after CRUD operations', async () => {
        const repositoryWithFilter = new MockMemoryRepository({
            schema: mockSchema,
            filter: (data, filters) => {
                if (filters.text) {
                    return data.title.toLowerCase().includes(filters.text.toLowerCase())
                }
                return true
            },
        })

        // Initial count should be 0
        expect(await repositoryWithFilter.count({})).toBe(0)

        // Create items
        const book1 = await repositoryWithFilter.create({
            title: 'Test Book 1',
            author: 'Author 1',
            publishedDate: new Date(),
        })
        const book2 = await repositoryWithFilter.create({
            title: 'Other Book',
            author: 'Author 2',
            publishedDate: new Date(),
        })

        // Count after creation
        expect(await repositoryWithFilter.count({})).toBe(2)
        expect(await repositoryWithFilter.count({ text: 'Test' })).toBe(1)

        // Remove an item
        await repositoryWithFilter.remove({ id: book1.id })

        // Count after removal
        expect(await repositoryWithFilter.count({})).toBe(1)
        expect(await repositoryWithFilter.count({ text: 'Test' })).toBe(0)

        // Restore the item
        await repositoryWithFilter.restore({ id: book1.id })

        // Count after restore
        expect(await repositoryWithFilter.count({})).toBe(2)
        expect(await repositoryWithFilter.count({ text: 'Test' })).toBe(1)
    })
})
