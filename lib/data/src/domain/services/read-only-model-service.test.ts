import { describe, it, expect, beforeEach, spyOn, mock } from 'bun:test'
import { ReadOnlyModelService } from './read-only-model-service'
import { MockMemoryRepository } from '../../test/mock/repositories/mock-memory-repository'
import { MockBookSchema } from '../../test/mock/models/mock-book-models'
import { EventManager } from '@declaro/core'
import type { QueryEvent } from '../events/query-event'
import type { InferDetail, InferFilters, InferLookup, InferSearchResults } from '../../shared/utils/schema-inference'

describe('ReadOnlyModelService', () => {
    const namespace = 'books'
    const primaryKey = 'id'
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
        repository = new MockMemoryRepository({ primaryKey, schema: mockSchema })
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
        const input = { id: '42', title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        await repository.create(input)

        const record = await service.load({ id: '42' })

        expect(record).toEqual(input)
    })

    it('should throw an error when loading a non-existent record', async () => {
        await expect(service.load({ id: '42' })).rejects.toThrow('Item not found')
    })

    it('should load multiple records', async () => {
        const input1 = { id: '42', title: 'Test Book 1', author: 'Author Name 1', publishedDate: new Date() }
        const input2 = { id: '43', title: 'Test Book 2', author: 'Author Name 2', publishedDate: new Date() }
        await repository.create(input1)
        await repository.create(input2)

        const records = await service.loadMany([{ id: '42' }, { id: '43' }])

        expect(records).toEqual([input1, input2])
    })

    it('should search for records', async () => {
        const input1 = { id: '42', title: 'Test Book 1', author: 'Author Name 1', publishedDate: new Date() }
        const input2 = { id: '43', title: 'Test Book 2', author: 'Author Name 2', publishedDate: new Date() }
        await repository.create(input1)
        await repository.create(input2)

        const results = await service.search({ text: 'Test' })

        expect(results.results).toEqual([input1, input2])
        expect(results.pagination.total).toBe(2)
    })

    it('should return empty results when searching for non-existent records', async () => {
        const results = await service.search({ text: 'Non-existent' })

        expect(results.results).toEqual([])
        expect(results.pagination.total).toBe(0)
    })

    it('should trigger before and after events for load', async () => {
        const input = { id: '42', title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        await repository.create(input)

        const record = await service.load({ id: '42' })

        expect(record).toEqual(input)
        expect(beforeLoadSpy).toHaveBeenCalledTimes(1)
        expect(beforeLoadSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'books::book.beforeLoad' }))
        expect(afterLoadSpy).toHaveBeenCalledTimes(1)
        expect(afterLoadSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'books::book.afterLoad' }))
    })

    it('should trigger before and after events for loadMany', async () => {
        const input1 = { id: '42', title: 'Test Book 1', author: 'Author Name 1', publishedDate: new Date() }
        const input2 = { id: '43', title: 'Test Book 2', author: 'Author Name 2', publishedDate: new Date() }
        await repository.create(input1)
        await repository.create(input2)

        const records = await service.loadMany([{ id: '42' }, { id: '43' }])

        expect(records).toEqual([input1, input2])
        expect(beforeLoadManySpy).toHaveBeenCalledTimes(1)
        expect(beforeLoadManySpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'books::book.beforeLoadMany' }))
        expect(afterLoadManySpy).toHaveBeenCalledTimes(1)
        expect(afterLoadManySpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'books::book.afterLoadMany' }))
    })

    it('should trigger before and after events for search', async () => {
        const input1 = { id: '42', title: 'Test Book 1', author: 'Author Name 1', publishedDate: new Date() }
        const input2 = { id: '43', title: 'Test Book 2', author: 'Author Name 2', publishedDate: new Date() }
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
})
