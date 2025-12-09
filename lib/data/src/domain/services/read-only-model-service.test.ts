import { describe, it, expect, beforeEach, spyOn, mock, beforeAll } from 'bun:test'
import { ReadOnlyModelService, type ILoadOptions } from './read-only-model-service'
import { MockMemoryRepository } from '../../test/mock/repositories/mock-memory-repository'
import { MockBookSchema, type MockBookDetail, type MockBookLookup } from '../../test/mock/models/mock-book-models'
import { EventManager } from '@declaro/core'
import type { QueryEvent } from '../events/query-event'
import type { InferDetail, InferFilters, InferLookup, InferSearchResults } from '../../shared/utils/schema-inference'

describe('ReadOnlyModelService', () => {
    const namespace = 'books'
    const mockSchema = MockBookSchema

    let repository: MockMemoryRepository<typeof mockSchema>
    let emitter: EventManager
    let service: ReadOnlyModelService<typeof mockSchema>

    const beforeLoadSpy = mock(
        (event: QueryEvent<InferDetail<typeof mockSchema>, InferLookup<typeof mockSchema>>) => {},
    )
    const afterLoadSpy = mock((event: QueryEvent<InferDetail<typeof mockSchema>, InferLookup<typeof mockSchema>>) => {})

    const beforeLoadManySpy = mock(
        (event: QueryEvent<InferDetail<typeof mockSchema>[], InferLookup<typeof mockSchema>[]>) => {},
    )
    const afterLoadManySpy = mock(
        (event: QueryEvent<InferDetail<typeof mockSchema>[], InferLookup<typeof mockSchema>[]>) => {},
    )

    const beforeSearchSpy = mock(
        (event: QueryEvent<InferSearchResults<typeof mockSchema>[], InferFilters<typeof mockSchema>[]>) => {},
    )
    const afterSearchSpy = mock(
        (event: QueryEvent<InferSearchResults<typeof mockSchema>[], InferFilters<typeof mockSchema>[]>) => {},
    )

    beforeEach(() => {
        repository = new MockMemoryRepository({ schema: mockSchema })
        emitter = new EventManager()

        beforeLoadSpy.mockClear()
        afterLoadSpy.mockClear()
        beforeLoadManySpy.mockClear()
        afterLoadManySpy.mockClear()
        beforeSearchSpy.mockClear()
        afterSearchSpy.mockClear()

        emitter.on<QueryEvent<InferDetail<typeof mockSchema>, InferLookup<typeof mockSchema>>>(
            'books::book.beforeLoad',
            beforeLoadSpy,
        )
        emitter.on<QueryEvent<InferDetail<typeof mockSchema>, InferLookup<typeof mockSchema>>>(
            'books::book.afterLoad',
            afterLoadSpy,
        )

        emitter.on<QueryEvent<InferDetail<typeof mockSchema>[], InferLookup<typeof mockSchema>[]>>(
            'books::book.beforeLoadMany',
            beforeLoadManySpy,
        )
        emitter.on<QueryEvent<InferDetail<typeof mockSchema>[], InferLookup<typeof mockSchema>[]>>(
            'books::book.afterLoadMany',
            afterLoadManySpy,
        )

        emitter.on<QueryEvent<InferSearchResults<typeof mockSchema>[], InferFilters<typeof mockSchema>[]>>(
            'books::book.beforeSearch',
            beforeSearchSpy,
        )
        emitter.on<QueryEvent<InferSearchResults<typeof mockSchema>[], InferFilters<typeof mockSchema>[]>>(
            'books::book.afterSearch',
            afterSearchSpy,
        )

        service = new ReadOnlyModelService({ repository, emitter, schema: mockSchema, namespace })
    })

    it('should load a single record', async () => {
        const input = { id: 42, title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        await repository.create(input)

        const record = await service.load({ id: 42 })

        expect(record).toEqual(input)
    })

    it('should return null when loading a non-existent record', async () => {
        const record = await service.load({ id: 999 })

        expect(record).toBeNull()
    })

    it('should load multiple records', async () => {
        const input1 = { id: 42, title: 'Test Book 1', author: 'Author Name 1', publishedDate: new Date() }
        const input2 = { id: 43, title: 'Test Book 2', author: 'Author Name 2', publishedDate: new Date() }
        await repository.create(input1)
        await repository.create(input2)

        const records = await service.loadMany([{ id: 42 }, { id: 43 }])

        expect(records).toEqual([input1, input2])
    })

    it('should search for records', async () => {
        const input1 = { id: 42, title: 'Test Book 1', author: 'Author Name 1', publishedDate: new Date() }
        const input2 = { id: 43, title: 'Test Book 2', author: 'Author Name 2', publishedDate: new Date() }
        await repository.create(input1)
        await repository.create(input2)

        const results = await service.search(
            { text: 'Test' },
            {
                sort: [
                    {
                        title: 'asc',
                    },
                    {
                        author: 'desc',
                    },
                ],
            },
        )

        expect(results.results).toEqual([input1, input2])
        expect(results.pagination.total).toBe(2)
    })

    it('should return empty results when searching for non-existent records', async () => {
        const results = await service.search({ text: 'Non-existent' })

        expect(results.results).toEqual([])
        expect(results.pagination.total).toBe(0)
    })

    it('should handle pagination options correctly', async () => {
        // Create 5 items
        for (let i = 1; i <= 5; i++) {
            await repository.create({
                id: i,
                title: `Test Book ${i}`,
                author: `Author ${i}`,
                publishedDate: new Date(),
            })
        }

        // Test first page with pageSize 2
        const page1 = await service.search(
            {},
            {
                pagination: { page: 1, pageSize: 2 },
            },
        )
        expect(page1.results).toHaveLength(2)
        expect(page1.pagination.page).toBe(1)
        expect(page1.pagination.pageSize).toBe(2)
        expect(page1.pagination.total).toBe(5)
        expect(page1.pagination.totalPages).toBe(3)

        // Test second page
        const page2 = await service.search(
            {},
            {
                pagination: { page: 2, pageSize: 2 },
            },
        )
        expect(page2.results).toHaveLength(2)
        expect(page2.pagination.page).toBe(2)

        // Test last page
        const page3 = await service.search(
            {},
            {
                pagination: { page: 3, pageSize: 2 },
            },
        )
        expect(page3.results).toHaveLength(1)
        expect(page3.pagination.page).toBe(3)
    })

    it('should handle sort options correctly', async () => {
        const input1 = { id: 1, title: 'Z Book', author: 'Author A', publishedDate: new Date('2023-01-01') }
        const input2 = { id: 2, title: 'A Book', author: 'Author B', publishedDate: new Date('2023-02-01') }
        const input3 = { id: 3, title: 'M Book', author: 'Author C', publishedDate: new Date('2023-03-01') }

        await repository.create(input1)
        await repository.create(input2)
        await repository.create(input3)

        // Sort by title ascending
        const titleAscResults = await service.search(
            {},
            {
                sort: [{ title: 'asc' }],
            },
        )
        expect(titleAscResults.results.map((r) => r.title)).toEqual(['A Book', 'M Book', 'Z Book'])

        // Sort by title descending
        const titleDescResults = await service.search(
            {},
            {
                sort: [{ title: 'desc' }],
            },
        )
        expect(titleDescResults.results.map((r) => r.title)).toEqual(['Z Book', 'M Book', 'A Book'])

        // Sort by author ascending
        const authorAscResults = await service.search(
            {},
            {
                sort: [{ author: 'asc' }],
            },
        )
        expect(authorAscResults.results.map((r) => r.author)).toEqual(['Author A', 'Author B', 'Author C'])
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

        const serviceWithFilter = new ReadOnlyModelService({
            repository: repositoryWithFilter,
            emitter,
            namespace,
            schema: mockSchema,
        })

        await repositoryWithFilter.create({ title: 'Test Z Book', author: 'Author 1', publishedDate: new Date() })
        await repositoryWithFilter.create({ title: 'Test A Book', author: 'Author 2', publishedDate: new Date() })
        await repositoryWithFilter.create({ title: 'Other Book', author: 'Author 3', publishedDate: new Date() })
        await repositoryWithFilter.create({ title: 'Test M Book', author: 'Author 4', publishedDate: new Date() })

        const results = await serviceWithFilter.search(
            { text: 'Test' },
            {
                sort: [{ title: 'asc' }],
                pagination: { page: 1, pageSize: 2 },
            },
        )

        expect(results.results).toHaveLength(2)
        expect(results.results.map((r) => r.title)).toEqual(['Test A Book', 'Test M Book'])
        expect(results.pagination.total).toBe(3) // 3 "Test" books total
        expect(results.pagination.totalPages).toBe(2)
    })

    it('should trigger before and after events for load', async () => {
        const input = { id: 42, title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        await repository.create(input)

        const record = await service.load({ id: 42 })

        expect(record).toEqual(input)
        expect(beforeLoadSpy).toHaveBeenCalledTimes(1)
        expect(beforeLoadSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'books::book.beforeLoad' }))
        expect(afterLoadSpy).toHaveBeenCalledTimes(1)
        expect(afterLoadSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'books::book.afterLoad' }))
    })

    it('should trigger before and after events for loadMany', async () => {
        const input1 = { id: 42, title: 'Test Book 1', author: 'Author Name 1', publishedDate: new Date() }
        const input2 = { id: 43, title: 'Test Book 2', author: 'Author Name 2', publishedDate: new Date() }
        await repository.create(input1)
        await repository.create(input2)

        const records = await service.loadMany([{ id: 42 }, { id: 43 }])

        expect(records).toEqual([input1, input2])
        expect(beforeLoadManySpy).toHaveBeenCalledTimes(1)
        expect(beforeLoadManySpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'books::book.beforeLoadMany' }))
        expect(afterLoadManySpy).toHaveBeenCalledTimes(1)
        expect(afterLoadManySpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'books::book.afterLoadMany' }))
    })

    it('should trigger before and after events for search', async () => {
        const input1 = { id: 42, title: 'Test Book 1', author: 'Author Name 1', publishedDate: new Date() }
        const input2 = { id: 43, title: 'Test Book 2', author: 'Author Name 2', publishedDate: new Date() }
        await repository.create(input1)
        await repository.create(input2)

        const results = await service.search({ text: 'Test' })

        expect(results.results).toEqual([input1, input2])
        expect(results.pagination.total).toBe(2)
        expect(beforeSearchSpy).toHaveBeenCalledTimes(1)
        expect(beforeSearchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'books::book.beforeSearch' }))
        expect(afterSearchSpy).toHaveBeenCalledTimes(1)
        expect(afterSearchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'books::book.afterSearch' }))
    })

    describe('Response Normalization', () => {
        class TestRepository extends MockMemoryRepository<typeof mockSchema> {
            constructor() {
                super({
                    schema: mockSchema,
                })
            }

            async load(input: MockBookLookup): Promise<MockBookDetail | null> {
                const record = await super.load(input)

                if (record) {
                    record.publishedDate = '2024-01-01' as any
                }

                return record
            }

            async loadMany(inputs: MockBookLookup[]): Promise<MockBookDetail[]> {
                const records = await super.loadMany(inputs)

                for (const record of records) {
                    record.publishedDate = '2024-01-01' as any
                }

                return records
            }

            async search(
                filters: InferFilters<typeof mockSchema>,
                options?: ILoadOptions,
            ): Promise<InferSearchResults<typeof mockSchema>> {
                const results = await super.search(filters, options)

                for (const record of results.results) {
                    record.publishedDate = '2024-01-01' as any
                }

                return results
            }
        }

        class TestServiceWithNormalization extends ReadOnlyModelService<typeof mockSchema> {
            async normalizeDetail(detail: InferDetail<typeof mockSchema>): Promise<InferDetail<typeof mockSchema>> {
                // Handle null case (e.g., when load returns null)
                if (!detail) return detail

                // Convert string dates back to Date objects
                if (typeof detail.publishedDate === 'string') {
                    detail.publishedDate = new Date(detail.publishedDate) as any
                }
                return detail
            }

            async normalizeSummary(summary: InferDetail<typeof mockSchema>): Promise<InferDetail<typeof mockSchema>> {
                // Handle null case (e.g., when load returns null)
                if (!summary) return summary

                // Convert string dates back to Date objects
                if (typeof summary.publishedDate === 'string') {
                    summary.publishedDate = new Date(summary.publishedDate) as any
                }
                return summary
            }
        }

        let testService: TestServiceWithNormalization

        beforeEach(() => {
            repository = new TestRepository()
            emitter = new EventManager()

            testService = new TestServiceWithNormalization({ repository, emitter, schema: mockSchema, namespace })
        })

        it('should allow custom normalization of details in the load response when overridden', async () => {
            const input = { id: 100, title: 'Normalization Test', author: 'Normalizer', publishedDate: new Date() }
            await repository.create(input)

            const record = await testService.load({ id: 100 })

            const expectedDate = new Date('2024-01-01')
            const actualDate = record.publishedDate

            expect(actualDate).toEqual(expectedDate)
            expect(actualDate).toBeInstanceOf(Date)
        })

        it('should allow custom normalization of details in the loadMany response when overridden', async () => {
            const input1 = { id: 101, title: 'Normalization Test 1', author: 'Normalizer 1', publishedDate: new Date() }
            const input2 = { id: 102, title: 'Normalization Test 2', author: 'Normalizer 2', publishedDate: new Date() }
            await repository.create(input1)
            await repository.create(input2)

            const records = await testService.loadMany([{ id: 101 }, { id: 102 }])

            const expectedDate = new Date('2024-01-01')

            for (const record of records) {
                const actualDate = record.publishedDate
                expect(actualDate).toEqual(expectedDate)
                expect(actualDate).toBeInstanceOf(Date)
            }
        })

        it('should allow custom normalization of summaries in the search response when overridden', async () => {
            const input1 = { id: 103, title: 'Normalization Test 3', author: 'Normalizer 3', publishedDate: new Date() }
            const input2 = { id: 104, title: 'Normalization Test 4', author: 'Normalizer 4', publishedDate: new Date() }
            await repository.create(input1)
            await repository.create(input2)

            const results = await testService.search({ text: 'Normalization' })

            const expectedDate = new Date('2024-01-01')

            for (const record of results.results) {
                const actualDate = record.publishedDate
                expect(actualDate).toEqual(expectedDate)
                expect(actualDate).toBeInstanceOf(Date)
            }
        })

        it('should not normalize data by default when normalization methods are not overridden', async () => {
            const defaultService = new ReadOnlyModelService({ repository, emitter, schema: mockSchema, namespace })

            const input = { id: 105, title: 'Default Test', author: 'Default Author', publishedDate: new Date() }
            await repository.create(input)

            const record = await defaultService.load({ id: 105 })

            // Should return the raw string from repository since no normalization is applied
            expect(record.publishedDate as any).toBe('2024-01-01')
            expect(typeof record.publishedDate).toBe('string')
        })
    })

    describe('Trash Functionality', () => {
        beforeEach(async () => {
            repository = new MockMemoryRepository({ schema: mockSchema })
            emitter = new EventManager()
            service = new ReadOnlyModelService({ repository, emitter, schema: mockSchema, namespace })
        })

        describe('load with trash options', () => {
            it('should not load removed items by default', async () => {
                const input = { id: 1, title: 'Book to Remove', author: 'Author', publishedDate: new Date() }
                await repository.create(input)
                await repository.remove({ id: 1 })

                const record = await service.load({ id: 1 })
                expect(record).toBeNull()
            })

            it('should load removed items with removedOnly option', async () => {
                const input = { id: 2, title: 'Removed Book', author: 'Author', publishedDate: new Date() }
                await repository.create(input)
                await repository.remove({ id: 2 })

                const record = await service.load({ id: 2 }, { removedOnly: true })
                expect(record).not.toBeNull()
                expect(record?.title).toBe('Removed Book')
            })

            it('should not load active items with removedOnly option', async () => {
                const input = { id: 3, title: 'Active Book', author: 'Author', publishedDate: new Date() }
                await repository.create(input)

                const record = await service.load({ id: 3 }, { removedOnly: true })
                expect(record).toBeNull()
            })

            it('should load removed items with includeRemoved option', async () => {
                const input = { id: 4, title: 'Removed Book', author: 'Author', publishedDate: new Date() }
                await repository.create(input)
                await repository.remove({ id: 4 })

                const record = await service.load({ id: 4 }, { includeRemoved: true })
                expect(record).not.toBeNull()
                expect(record?.title).toBe('Removed Book')
            })

            it('should load active items with includeRemoved option', async () => {
                const input = { id: 5, title: 'Active Book', author: 'Author', publishedDate: new Date() }
                await repository.create(input)

                const record = await service.load({ id: 5 }, { includeRemoved: true })
                expect(record).not.toBeNull()
                expect(record?.title).toBe('Active Book')
            })
        })

        describe('search with trash options', () => {
            it('should not return removed items by default', async () => {
                await repository.create({ id: 1, title: 'Active Book', author: 'Author 1', publishedDate: new Date() })
                const removed = await repository.create({
                    id: 2,
                    title: 'Removed Book',
                    author: 'Author 2',
                    publishedDate: new Date(),
                })
                await repository.remove({ id: 2 })

                const results = await service.search({})
                expect(results.results).toHaveLength(1)
                expect(results.results[0].title).toBe('Active Book')
            })

            it('should return only removed items with removedOnly option', async () => {
                await repository.create({ id: 1, title: 'Active Book', author: 'Author 1', publishedDate: new Date() })
                const removed1 = await repository.create({
                    id: 2,
                    title: 'Removed Book 1',
                    author: 'Author 2',
                    publishedDate: new Date(),
                })
                const removed2 = await repository.create({
                    id: 3,
                    title: 'Removed Book 2',
                    author: 'Author 3',
                    publishedDate: new Date(),
                })

                await repository.remove({ id: 2 })
                await repository.remove({ id: 3 })

                const results = await service.search({}, { removedOnly: true })
                expect(results.results).toHaveLength(2)
                expect(results.results.every((book) => book.title.startsWith('Removed'))).toBe(true)
            })

            it('should return both active and removed items with includeRemoved option', async () => {
                await repository.create({
                    id: 1,
                    title: 'Active Book 1',
                    author: 'Author 1',
                    publishedDate: new Date(),
                })
                await repository.create({
                    id: 2,
                    title: 'Active Book 2',
                    author: 'Author 2',
                    publishedDate: new Date(),
                })
                const removed = await repository.create({
                    id: 3,
                    title: 'Removed Book',
                    author: 'Author 3',
                    publishedDate: new Date(),
                })

                await repository.remove({ id: 3 })

                const results = await service.search({}, { includeRemoved: true })
                expect(results.results).toHaveLength(3)
            })

            it('should filter removed items with removedOnly option', async () => {
                const repositoryWithFilter = new MockMemoryRepository({
                    schema: mockSchema,
                    filter: (data, filters) => {
                        if (filters.text) {
                            return data.title.toLowerCase().includes(filters.text.toLowerCase())
                        }
                        return true
                    },
                })

                const serviceWithFilter = new ReadOnlyModelService({
                    repository: repositoryWithFilter,
                    emitter,
                    namespace,
                    schema: mockSchema,
                })

                const removed1 = await repositoryWithFilter.create({
                    title: 'Test Removed Book',
                    author: 'Author 1',
                    publishedDate: new Date(),
                })
                const removed2 = await repositoryWithFilter.create({
                    title: 'Other Removed Book',
                    author: 'Author 2',
                    publishedDate: new Date(),
                })

                await repositoryWithFilter.remove({ id: removed1.id })
                await repositoryWithFilter.remove({ id: removed2.id })

                const results = await serviceWithFilter.search({ text: 'Test' }, { removedOnly: true })
                expect(results.results).toHaveLength(1)
                expect(results.results[0].title).toBe('Test Removed Book')
            })

            it('should filter across active and removed items with includeRemoved option', async () => {
                const repositoryWithFilter = new MockMemoryRepository({
                    schema: mockSchema,
                    filter: (data, filters) => {
                        if (filters.text) {
                            return data.title.toLowerCase().includes(filters.text.toLowerCase())
                        }
                        return true
                    },
                })

                const serviceWithFilter = new ReadOnlyModelService({
                    repository: repositoryWithFilter,
                    emitter,
                    namespace,
                    schema: mockSchema,
                })

                await repositoryWithFilter.create({
                    title: 'Test Active Book',
                    author: 'Author 1',
                    publishedDate: new Date(),
                })
                const removed = await repositoryWithFilter.create({
                    title: 'Test Removed Book',
                    author: 'Author 2',
                    publishedDate: new Date(),
                })
                await repositoryWithFilter.create({
                    title: 'Other Book',
                    author: 'Author 3',
                    publishedDate: new Date(),
                })

                await repositoryWithFilter.remove({ id: removed.id })

                const results = await serviceWithFilter.search({ text: 'Test' }, { includeRemoved: true })
                expect(results.results).toHaveLength(2)
                expect(results.results.some((book) => book.title === 'Test Active Book')).toBe(true)
                expect(results.results.some((book) => book.title === 'Test Removed Book')).toBe(true)
            })
        })

        describe('count with trash options', () => {
            it('should count only active items by default', async () => {
                await repository.create({ id: 1, title: 'Active Book', author: 'Author 1', publishedDate: new Date() })
                const removed = await repository.create({
                    id: 2,
                    title: 'Removed Book',
                    author: 'Author 2',
                    publishedDate: new Date(),
                })
                await repository.remove({ id: 2 })

                const count = await service.count({})
                expect(count).toBe(1)
            })

            it('should count only removed items with removedOnly option', async () => {
                await repository.create({ id: 1, title: 'Active Book', author: 'Author 1', publishedDate: new Date() })
                const removed1 = await repository.create({
                    id: 2,
                    title: 'Removed Book 1',
                    author: 'Author 2',
                    publishedDate: new Date(),
                })
                const removed2 = await repository.create({
                    id: 3,
                    title: 'Removed Book 2',
                    author: 'Author 3',
                    publishedDate: new Date(),
                })

                await repository.remove({ id: 2 })
                await repository.remove({ id: 3 })

                const count = await service.count({}, { removedOnly: true })
                expect(count).toBe(2)
            })

            it('should count both active and removed items with includeRemoved option', async () => {
                await repository.create({ id: 1, title: 'Active Book', author: 'Author 1', publishedDate: new Date() })
                const removed = await repository.create({
                    id: 2,
                    title: 'Removed Book',
                    author: 'Author 2',
                    publishedDate: new Date(),
                })
                await repository.remove({ id: 2 })

                const count = await service.count({}, { includeRemoved: true })
                expect(count).toBe(2)
            })

            it('should count filtered active items by default', async () => {
                const repositoryWithFilter = new MockMemoryRepository({
                    schema: mockSchema,
                    filter: (data, filters) => {
                        if (filters.text) {
                            return data.title.toLowerCase().includes(filters.text.toLowerCase())
                        }
                        return true
                    },
                })

                const serviceWithFilter = new ReadOnlyModelService({
                    repository: repositoryWithFilter,
                    emitter,
                    namespace,
                    schema: mockSchema,
                })

                await repositoryWithFilter.create({
                    title: 'Test Book 1',
                    author: 'Author 1',
                    publishedDate: new Date(),
                })
                await repositoryWithFilter.create({
                    title: 'Test Book 2',
                    author: 'Author 2',
                    publishedDate: new Date(),
                })
                await repositoryWithFilter.create({
                    title: 'Other Book',
                    author: 'Author 3',
                    publishedDate: new Date(),
                })
                const removed = await repositoryWithFilter.create({
                    title: 'Test Book 3',
                    author: 'Author 4',
                    publishedDate: new Date(),
                })

                await repositoryWithFilter.remove({ id: removed.id })

                const count = await serviceWithFilter.count({ text: 'Test' })
                expect(count).toBe(2)
            })

            it('should count filtered removed items with removedOnly option', async () => {
                const repositoryWithFilter = new MockMemoryRepository({
                    schema: mockSchema,
                    filter: (data, filters) => {
                        if (filters.text) {
                            return data.title.toLowerCase().includes(filters.text.toLowerCase())
                        }
                        return true
                    },
                })

                const serviceWithFilter = new ReadOnlyModelService({
                    repository: repositoryWithFilter,
                    emitter,
                    namespace,
                    schema: mockSchema,
                })

                const removed1 = await repositoryWithFilter.create({
                    title: 'Test Removed Book 1',
                    author: 'Author 1',
                    publishedDate: new Date(),
                })
                const removed2 = await repositoryWithFilter.create({
                    title: 'Test Removed Book 2',
                    author: 'Author 2',
                    publishedDate: new Date(),
                })
                const removed3 = await repositoryWithFilter.create({
                    title: 'Other Removed Book',
                    author: 'Author 3',
                    publishedDate: new Date(),
                })
                const active = await repositoryWithFilter.create({
                    title: 'Test Active Book',
                    author: 'Author 4',
                    publishedDate: new Date(),
                })

                await repositoryWithFilter.remove({ id: removed1.id })
                await repositoryWithFilter.remove({ id: removed2.id })
                await repositoryWithFilter.remove({ id: removed3.id })

                const count = await serviceWithFilter.count({ text: 'Test' }, { removedOnly: true })
                expect(count).toBe(2)
            })

            it('should count filtered items across active and removed with includeRemoved option', async () => {
                const repositoryWithFilter = new MockMemoryRepository({
                    schema: mockSchema,
                    filter: (data, filters) => {
                        if (filters.text) {
                            return data.title.toLowerCase().includes(filters.text.toLowerCase())
                        }
                        return true
                    },
                })

                const serviceWithFilter = new ReadOnlyModelService({
                    repository: repositoryWithFilter,
                    emitter,
                    namespace,
                    schema: mockSchema,
                })

                await repositoryWithFilter.create({
                    title: 'Test Active Book 1',
                    author: 'Author 1',
                    publishedDate: new Date(),
                })
                await repositoryWithFilter.create({
                    title: 'Test Active Book 2',
                    author: 'Author 2',
                    publishedDate: new Date(),
                })
                const removed1 = await repositoryWithFilter.create({
                    title: 'Test Removed Book 1',
                    author: 'Author 3',
                    publishedDate: new Date(),
                })
                const removed2 = await repositoryWithFilter.create({
                    title: 'Test Removed Book 2',
                    author: 'Author 4',
                    publishedDate: new Date(),
                })
                await repositoryWithFilter.create({
                    title: 'Other Active Book',
                    author: 'Author 5',
                    publishedDate: new Date(),
                })

                await repositoryWithFilter.remove({ id: removed1.id })
                await repositoryWithFilter.remove({ id: removed2.id })

                const count = await serviceWithFilter.count({ text: 'Test' }, { includeRemoved: true })
                expect(count).toBe(4)
            })
        })
    })
})
