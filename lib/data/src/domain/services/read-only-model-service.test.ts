import { describe, it, expect, beforeEach } from 'bun:test'
import { ReadOnlyModelService } from './read-only-model-service'
import { MockMemoryRepository } from '../../test/mock/repositories/mock-memory-repository'
import { MockBookSchema } from '../../test/mock/models/mock-book-models'
import { EventManager } from '@declaro/core'

describe('ReadOnlyModelService', () => {
    const namespace = 'books'
    const primaryKey = 'id'
    const mockSchema = MockBookSchema

    let repository: MockMemoryRepository<typeof mockSchema>
    let emitter: EventManager
    let service: ReadOnlyModelService<typeof mockSchema>

    beforeEach(() => {
        repository = new MockMemoryRepository({ primaryKey, schema: mockSchema })
        emitter = new EventManager()
        service = new ReadOnlyModelService({ repository, emitter, schema: mockSchema })
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
})
