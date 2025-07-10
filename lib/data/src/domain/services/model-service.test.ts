import { describe, it, expect, beforeEach } from 'bun:test'
import { ModelService } from './model-service'
import { MockMemoryRepository } from '../../test/mock/repositories/mock-memory-repository'
import { MockBookSchema } from '../../test/mock/models/mock-book-models'
import { EventManager } from '@declaro/core'
import { mock } from 'bun:test'

describe('ModelService', () => {
    const namespace = 'books'
    const mockSchema = MockBookSchema

    let repository: MockMemoryRepository<typeof mockSchema>
    let emitter: EventManager
    let service: ModelService<typeof mockSchema>

    beforeEach(() => {
        repository = new MockMemoryRepository({ schema: mockSchema })
        emitter = new EventManager()
        service = new ModelService({ repository, emitter, schema: mockSchema, namespace })
    })

    const beforeCreateSpy = mock((event) => {})
    const afterCreateSpy = mock((event) => {})
    const beforeUpdateSpy = mock((event) => {})
    const afterUpdateSpy = mock((event) => {})
    const beforeRemoveSpy = mock((event) => {})
    const afterRemoveSpy = mock((event) => {})
    const beforeRestoreSpy = mock((event) => {})
    const afterRestoreSpy = mock((event) => {})

    beforeEach(() => {
        emitter.on('books::book.beforeCreate', beforeCreateSpy)
        emitter.on('books::book.afterCreate', afterCreateSpy)
        emitter.on('books::book.beforeUpdate', beforeUpdateSpy)
        emitter.on('books::book.afterUpdate', afterUpdateSpy)
        emitter.on('books::book.beforeRemove', beforeRemoveSpy)
        emitter.on('books::book.afterRemove', afterRemoveSpy)
        emitter.on('books::book.beforeRestore', beforeRestoreSpy)
        emitter.on('books::book.afterRestore', afterRestoreSpy)

        beforeCreateSpy.mockClear()
        afterCreateSpy.mockClear()
        beforeUpdateSpy.mockClear()
        afterUpdateSpy.mockClear()
        beforeRemoveSpy.mockClear()
        afterRemoveSpy.mockClear()
        beforeRestoreSpy.mockClear()
        afterRestoreSpy.mockClear()
    })

    it('should create a record', async () => {
        const input = { id: 42, title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        const createdRecord = await service.create(input)

        expect(createdRecord).toEqual(input)
    })

    it('should update a record', async () => {
        const input = { id: 42, title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        await repository.create(input)

        const updatedInput = { title: 'Updated Book', author: 'Updated Author', publishedDate: new Date() }
        const updatedRecord = await service.update({ id: 42 }, updatedInput)

        expect(updatedRecord).toEqual({ id: 42, ...updatedInput })
    })

    it('should remove a record', async () => {
        const input = { id: 42, title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        await repository.create(input)

        const removedRecord = await service.remove({ id: 42 })

        expect(removedRecord).toEqual(input)
        expect(await repository.load({ id: 42 })).toBeNull()
    })

    it('should restore a record', async () => {
        const input = { id: 42, title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        await repository.create(input)
        await repository.remove({ id: 42 })

        const restoredRecord = await service.restore({ id: 42 })

        expect(restoredRecord).toEqual(input)
        expect(await repository.load({ id: 42 })).toEqual(input)
    })

    it('should trigger before and after events for create', async () => {
        const input = { id: 42, title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        const createdRecord = await service.create(input)

        expect(createdRecord).toEqual(input)
        expect(beforeCreateSpy).toHaveBeenCalledTimes(1)
        expect(beforeCreateSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'books::book.beforeCreate' }))
        expect(afterCreateSpy).toHaveBeenCalledTimes(1)
        expect(afterCreateSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'books::book.afterCreate' }))
    })

    it('should trigger before and after events for update', async () => {
        const input = { id: 42, title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        await repository.create(input)

        const updatedInput = { title: 'Updated Book', author: 'Updated Author', publishedDate: new Date() }
        const updatedRecord = await service.update({ id: 42 }, updatedInput)

        expect(updatedRecord).toEqual({ id: 42, ...updatedInput })
        expect(beforeUpdateSpy).toHaveBeenCalledTimes(1)
        expect(beforeUpdateSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'books::book.beforeUpdate' }))
        expect(afterUpdateSpy).toHaveBeenCalledTimes(1)
        expect(afterUpdateSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'books::book.afterUpdate' }))
    })

    it('should trigger before and after events for remove', async () => {
        const input = { id: 42, title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        await repository.create(input)

        const removedRecord = await service.remove({ id: 42 })

        expect(removedRecord).toEqual(input)
        expect(beforeRemoveSpy).toHaveBeenCalledTimes(1)
        expect(beforeRemoveSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'books::book.beforeRemove' }))
        expect(afterRemoveSpy).toHaveBeenCalledTimes(1)
        expect(afterRemoveSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'books::book.afterRemove' }))
    })

    it('should trigger before and after events for restore', async () => {
        const input = { id: 42, title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        await repository.create(input)
        await repository.remove({ id: 42 })

        const restoredRecord = await service.restore({ id: 42 })

        expect(restoredRecord).toEqual(input)
        expect(beforeRestoreSpy).toHaveBeenCalledTimes(1)
        expect(beforeRestoreSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'books::book.beforeRestore' }))
        expect(afterRestoreSpy).toHaveBeenCalledTimes(1)
        expect(afterRestoreSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'books::book.afterRestore' }))
    })

    it('should throw an error when attempting to remove a non-existent record', async () => {
        await expect(service.remove({ id: 999 })).rejects.toThrow('Item not found')
    })

    it('should throw an error when attempting to update a non-existent record', async () => {
        const updatedInput = { title: 'Updated Book', author: 'Updated Author', publishedDate: new Date() }
        await expect(service.update({ id: 999 }, updatedInput)).rejects.toThrow('Item not found')
    })
})
