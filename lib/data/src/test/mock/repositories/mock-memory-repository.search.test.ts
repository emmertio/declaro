import { beforeEach, describe, expect, it } from 'bun:test'
import { MockBookSchema } from '../models/mock-book-models'
import { MockMemoryRepository } from './mock-memory-repository'

describe('MockMemoryRepository - Search Functionality', () => {
    const mockSchema = MockBookSchema

    let repository: MockMemoryRepository<typeof mockSchema>

    beforeEach(() => {
        repository = new MockMemoryRepository({ schema: mockSchema })
    })

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
