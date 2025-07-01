import { describe, it, expect, beforeEach } from 'bun:test'
import { ModelService } from './model-service'
import { MockMemoryRepository } from '../../test/mock/repositories/mock-memory-repository'
import { MockBookSchema } from '../../test/mock/models/mock-book-models'
import { EventManager } from '@declaro/core'

describe('ModelService', () => {
    const namespace = 'books'
    const primaryKey = 'id'
    const mockSchema = MockBookSchema

    let repository: MockMemoryRepository<typeof mockSchema>
    let emitter: EventManager
    let service: ModelService<typeof mockSchema>

    beforeEach(() => {
        repository = new MockMemoryRepository({ primaryKey, schema: mockSchema })
        emitter = new EventManager()
        service = new ModelService({ repository, emitter, schema: mockSchema })
    })

    it('should create a record', async () => {
        const input = { id: '42', title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        const createdRecord = await service.create(input)

        expect(createdRecord).toEqual(input)
    })

    it('should update a record', async () => {
        const input = { id: '42', title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        await repository.create(input)

        const updatedInput = { title: 'Updated Book', author: 'Updated Author', publishedDate: new Date() }
        const updatedRecord = await service.update({ id: '42' }, updatedInput)

        expect(updatedRecord).toEqual({ id: '42', ...updatedInput })
    })

    it('should remove a record', async () => {
        const input = { id: '42', title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        await repository.create(input)

        const removedRecord = await service.remove({ id: '42' })

        expect(removedRecord).toEqual(input)
        await expect(repository.load({ id: '42' })).rejects.toThrow('Item not found')
    })

    it('should restore a record', async () => {
        const input = { id: '42', title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        await repository.create(input)
        await repository.remove({ id: '42' })

        const restoredRecord = await service.restore({ id: '42' })

        expect(restoredRecord).toEqual(input)
        expect(await repository.load({ id: '42' })).toEqual(input)
    })
})
