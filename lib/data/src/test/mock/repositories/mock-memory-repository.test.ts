import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { MockBookSchema } from '../models/mock-book-models'
import { MockMemoryRepository } from './mock-memory-repository'
import { z } from 'zod/v4'
import { ZodModel } from '@declaro/zod'

describe('MockMemoryRepository', () => {
    const mockSchema = MockBookSchema

    let repository: MockMemoryRepository<typeof mockSchema>

    beforeEach(() => {
        repository = new MockMemoryRepository({ schema: mockSchema })
    })

    it('should create an item', async () => {
        const input = { id: 42, title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        const createdItem = await repository.create(input)

        expect(createdItem).toEqual(input)
        expect(await repository.load({ id: createdItem.id })).toEqual(createdItem)
    })

    it('should throw an error when creating an item with duplicate primary key', async () => {
        const input = { id: 42, title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        const createdItem = await repository.create(input)

        await expect(repository.create({ ...input, id: createdItem.id })).rejects.toThrow(
            'Item with the same primary key already exists',
        )
    })

    it('should update an existing item', async () => {
        const input = { id: 42, title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        const createdItem = await repository.create(input)

        const updatedInput = { title: 'Updated Book', author: 'Updated Author', publishedDate: new Date() }
        const updatedItem = await repository.update({ id: createdItem.id }, updatedInput)

        expect(updatedItem).toEqual({ id: createdItem.id, ...updatedInput })
        expect(await repository.load({ id: createdItem.id })).toEqual({ id: createdItem.id, ...updatedInput })
    })

    it('should throw an error when updating a non-existent item', async () => {
        const input = { id: 42, title: 'Test Book', author: 'Author Name', publishedDate: new Date() }

        await expect(repository.update({ id: 999 }, input)).rejects.toThrow('Item not found')
    })

    it('should remove an item', async () => {
        const input = { id: 42, title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        const createdItem = await repository.create(input)

        const removedItem = await repository.remove({ id: createdItem.id })

        expect(removedItem).toEqual(input)
        const loadedItem = await repository.load({ id: createdItem.id })
        expect(loadedItem).toBeNull()
    })

    it('should restore a removed item', async () => {
        const input = { id: 42, title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        const createdItem = await repository.create(input)
        await repository.remove({ id: createdItem.id })

        const restoredItem = await repository.restore({ id: createdItem.id })

        expect(restoredItem).toEqual(input)
        expect(await repository.load({ id: createdItem.id })).toEqual(input)
    })

    it('should throw an error when restoring a non-existent item', async () => {
        await expect(repository.restore({ id: 999 })).rejects.toThrow('Item not found in trash')
    })

    it('should allow me to create an item without a primary key', async () => {
        const input = { title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        const createdItem = await repository.create(input)

        expect(createdItem.id).toBeDefined()
        expect(createdItem.title).toBe(input.title)
        expect(createdItem.author).toBe(input.author)
        expect(await repository.load({ id: createdItem.id })).toEqual(createdItem)
    })

    it('should increment ids when creating items without a primary key', async () => {
        const input1 = { title: 'Test Book 1', author: 'Author Name 1', publishedDate: new Date() }
        const input2 = { title: 'Test Book 2', author: 'Author Name 2', publishedDate: new Date() }

        const createdItem1 = await repository.create(input1)
        const createdItem2 = await repository.create(input2)

        expect(createdItem1.id).toBe(1)
        expect(createdItem2.id).toBe(2)
        expect(await repository.load({ id: createdItem1.id })).toEqual(createdItem1)
        expect(await repository.load({ id: createdItem2.id })).toEqual(createdItem2)
    })

    it('should return null when loading a non-existent item', async () => {
        const result = await repository.load({ id: 999 })
        expect(result).toBeNull()
    })

    it('should be able to load items from a custom filter', async () => {
        // Creating a hypothetical schema with a custom filter, and a title lookup attribute
        const repository = new MockMemoryRepository({
            schema: mockSchema.custom({
                lookup: (h) =>
                    new ZodModel(
                        h.name,
                        z.object({
                            id: z.number().optional(),
                            title: z.string().optional(),
                        }),
                    ),
            }),
            lookup: (data, lookup) =>
                data.id === lookup.id || data.title?.toLowerCase() === lookup.title?.toLowerCase(),
        })

        const input = { title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        const createdItem = await repository.create(input)

        const loadedItem = await repository.load({ id: createdItem.id })
        const titleLoadedItem = await repository.load({ title: createdItem.title })
        expect(loadedItem).toEqual(createdItem)
        expect(titleLoadedItem).toEqual(createdItem)
    })

    describe('search functionality', () => {
        it('should search for all items when no filter is provided', async () => {
            const input1 = { title: 'Book One', author: 'Author A', publishedDate: new Date('2023-01-01') }
            const input2 = { title: 'Book Two', author: 'Author B', publishedDate: new Date('2023-02-01') }
            const input3 = { title: 'Book Three', author: 'Author C', publishedDate: new Date('2023-03-01') }

            const item1 = await repository.create(input1)
            const item2 = await repository.create(input2)
            const item3 = await repository.create(input3)

            const results = await repository.search({})

            expect(results.results).toHaveLength(3)
            expect(results.results).toEqual(expect.arrayContaining([item1, item2, item3]))
            expect(results.pagination.total).toBe(3)
            expect(results.pagination.page).toBe(1)
            expect(results.pagination.pageSize).toBe(25)
            expect(results.pagination.totalPages).toBe(1)
        })

        it('should filter items using custom filter function', async () => {
            const repositoryWithFilter = new MockMemoryRepository({
                schema: mockSchema,
                filter: (data, filters) => {
                    if (filters.text) {
                        return (
                            data.title.toLowerCase().includes(filters.text.toLowerCase()) ||
                            data.author.toLowerCase().includes(filters.text.toLowerCase())
                        )
                    }
                    return true
                },
            })

            const input1 = { title: 'JavaScript Guide', author: 'John Doe', publishedDate: new Date() }
            const input2 = { title: 'Python Handbook', author: 'Jane Smith', publishedDate: new Date() }
            const input3 = { title: 'Java Programming', author: 'John Johnson', publishedDate: new Date() }

            const item1 = await repositoryWithFilter.create(input1)
            const item2 = await repositoryWithFilter.create(input2)
            const item3 = await repositoryWithFilter.create(input3)

            // Search by title
            const titleResults = await repositoryWithFilter.search({ text: 'JavaScript' })
            expect(titleResults.results).toEqual([item1])

            // Search by author
            const authorResults = await repositoryWithFilter.search({ text: 'John' })
            expect(authorResults.results).toHaveLength(2)
            expect(authorResults.results).toEqual(expect.arrayContaining([item1, item3]))

            // Search with no matches
            const noResults = await repositoryWithFilter.search({ text: 'Ruby' })
            expect(noResults.results).toEqual([])
            expect(noResults.pagination.total).toBe(0)
        })

        it('should handle pagination correctly', async () => {
            // Create 10 items
            for (let i = 1; i <= 10; i++) {
                const input = { title: `Book ${i}`, author: `Author ${i}`, publishedDate: new Date() }
                await repository.create(input)
            }

            // Test first page with pageSize 3
            const page1 = await repository.search(
                {},
                {
                    pagination: { page: 1, pageSize: 3 },
                },
            )
            expect(page1.results).toHaveLength(3)
            expect(page1.pagination.page).toBe(1)
            expect(page1.pagination.pageSize).toBe(3)
            expect(page1.pagination.total).toBe(10)
            expect(page1.pagination.totalPages).toBe(4)

            // Test second page
            const page2 = await repository.search(
                {},
                {
                    pagination: { page: 2, pageSize: 3 },
                },
            )
            expect(page2.results).toHaveLength(3)
            expect(page2.pagination.page).toBe(2)
            expect(page2.pagination.pageSize).toBe(3)

            // Test last page (should have 1 item)
            const page4 = await repository.search(
                {},
                {
                    pagination: { page: 4, pageSize: 3 },
                },
            )
            expect(page4.results).toHaveLength(1)
            expect(page4.pagination.page).toBe(4)

            // Test page beyond available data
            const pageEmpty = await repository.search(
                {},
                {
                    pagination: { page: 5, pageSize: 3 },
                },
            )
            expect(pageEmpty.results).toHaveLength(0)
        })

        it('should use default pagination when not provided', async () => {
            // Create 30 items to test default pagination
            for (let i = 1; i <= 30; i++) {
                await repository.create({ title: `Book ${i}`, author: `Author ${i}`, publishedDate: new Date() })
            }

            const results = await repository.search({})
            expect(results.pagination.page).toBe(1)
            expect(results.pagination.pageSize).toBe(25)
            expect(results.pagination.total).toBe(30)
            expect(results.pagination.totalPages).toBe(2)
            expect(results.results).toHaveLength(25)
        })

        it('should handle edge cases with pagination', async () => {
            // Test with empty repository
            const emptyResults = await repository.search(
                {},
                {
                    pagination: { page: 1, pageSize: 10 },
                },
            )
            expect(emptyResults.results).toEqual([])
            expect(emptyResults.pagination.total).toBe(0)
            expect(emptyResults.pagination.totalPages).toBe(0)

            // Test with page 0 (results in empty due to slice calculation)
            await repository.create({ title: 'Test Book', author: 'Test Author', publishedDate: new Date() })
            const page0Results = await repository.search(
                {},
                {
                    pagination: { page: 0, pageSize: 10 },
                },
            )
            expect(page0Results.pagination.page).toBe(0)
            expect(page0Results.results).toHaveLength(0) // slice(-10, 0) returns empty array
        })

        it('should handle sorting correctly', async () => {
            const input1 = { title: 'C Book', author: 'Author Z', publishedDate: new Date('2023-03-01') }
            const input2 = { title: 'A Book', author: 'Author Y', publishedDate: new Date('2023-01-01') }
            const input3 = { title: 'B Book', author: 'Author X', publishedDate: new Date('2023-02-01') }

            const item1 = await repository.create(input1)
            const item2 = await repository.create(input2)
            const item3 = await repository.create(input3)

            // Sort by title ascending
            const titleAscResults = await repository.search(
                {},
                {
                    sort: [{ title: 'asc' }],
                },
            )
            expect(titleAscResults.results.map((r) => r.title)).toEqual(['A Book', 'B Book', 'C Book'])

            // Sort by title descending
            const titleDescResults = await repository.search(
                {},
                {
                    sort: [{ title: 'desc' }],
                },
            )
            expect(titleDescResults.results.map((r) => r.title)).toEqual(['C Book', 'B Book', 'A Book'])

            // Sort by author ascending
            const authorAscResults = await repository.search(
                {},
                {
                    sort: [{ author: 'asc' }],
                },
            )
            expect(authorAscResults.results.map((r) => r.author)).toEqual(['Author X', 'Author Y', 'Author Z'])

            // Multiple field sort: title asc, then author desc
            const multiSortResults = await repository.search(
                {},
                {
                    sort: [{ title: 'asc' }, { author: 'desc' }],
                },
            )
            expect(multiSortResults.results.map((r) => r.title)).toEqual(['A Book', 'B Book', 'C Book'])
        })

        it('should handle sorting with pagination', async () => {
            for (let i = 1; i <= 5; i++) {
                await repository.create({
                    title: `Book ${String.fromCharCode(69 - i)}`, // D, C, B, A, @
                    author: `Author ${i}`,
                    publishedDate: new Date(),
                })
            }

            // Sort by title ascending and get first page
            const sortedPage1 = await repository.search(
                {},
                {
                    sort: [{ title: 'asc' }],
                    pagination: { page: 1, pageSize: 2 },
                },
            )
            expect(sortedPage1.results.map((r) => r.title)).toEqual(['Book @', 'Book A'])
            expect(sortedPage1.pagination.totalPages).toBe(3)

            // Get second page with same sort
            const sortedPage2 = await repository.search(
                {},
                {
                    sort: [{ title: 'asc' }],
                    pagination: { page: 2, pageSize: 2 },
                },
            )
            expect(sortedPage2.results.map((r) => r.title)).toEqual(['Book B', 'Book C'])
        })

        it('should handle combined filtering, sorting, and pagination', async () => {
            const repositoryWithFilter = new MockMemoryRepository({
                schema: mockSchema,
                filter: (data, filters) => {
                    if (filters.text) {
                        return data.title.toLowerCase().includes(filters.text.toLowerCase())
                    }
                    return true
                },
            })

            await repositoryWithFilter.create({ title: 'Test Z Book', author: 'Author 1', publishedDate: new Date() })
            await repositoryWithFilter.create({ title: 'Test A Book', author: 'Author 2', publishedDate: new Date() })
            await repositoryWithFilter.create({ title: 'Other Book', author: 'Author 3', publishedDate: new Date() })
            await repositoryWithFilter.create({ title: 'Test B Book', author: 'Author 4', publishedDate: new Date() })

            const results = await repositoryWithFilter.search(
                { text: 'Test' },
                {
                    sort: [{ title: 'asc' }],
                    pagination: { page: 1, pageSize: 2 },
                },
            )

            expect(results.results).toHaveLength(2)
            expect(results.results.map((r) => r.title)).toEqual(['Test A Book', 'Test B Book'])
            expect(results.pagination.total).toBe(3) // 3 "Test" books total
            expect(results.pagination.totalPages).toBe(2)
        })
    })

    describe('count functionality', () => {
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
})
