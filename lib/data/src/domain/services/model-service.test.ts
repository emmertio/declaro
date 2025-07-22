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

    describe('upsert functionality', () => {
        it('should create a new record when no existing record with primary key exists', async () => {
            const input = { id: 42, title: 'New Book', author: 'Author Name', publishedDate: new Date() }

            const upsertedRecord = await service.upsert(input)

            expect(upsertedRecord).toEqual(input)
            expect(await repository.load({ id: 42 })).toEqual(input)
        })

        it('should update an existing record when primary key matches', async () => {
            // Create initial record
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
            const upsertedRecord = await service.upsert(update)

            expect(upsertedRecord).toEqual(update)
            expect(await repository.load({ id: 42 })).toEqual(update)
        })

        it('should create a new record when upserting without primary key', async () => {
            const input = { title: 'Book Without ID', author: 'Author Name', publishedDate: new Date() }

            const upsertedRecord = await service.upsert(input)

            expect(upsertedRecord.id).toBeDefined()
            expect(upsertedRecord.title).toBe(input.title)
            expect(upsertedRecord.author).toBe(input.author)
            expect(await repository.load({ id: upsertedRecord.id })).toEqual(upsertedRecord)
        })

        it('should create a new record when primary key is null', async () => {
            const input = {
                id: undefined,
                title: 'Book With Undefined ID',
                author: 'Author Name',
                publishedDate: new Date(),
            }

            const upsertedRecord = await service.upsert(input)

            expect(upsertedRecord.id).toBeDefined()
            expect(upsertedRecord.id).not.toBeNull()
            expect(upsertedRecord.title).toBe(input.title)
            expect(upsertedRecord.author).toBe(input.author)
        })

        it('should trigger create events when upserting a new record', async () => {
            const input = { id: 42, title: 'New Book', author: 'Author Name', publishedDate: new Date() }

            const upsertedRecord = await service.upsert(input)

            expect(upsertedRecord).toEqual(input)
            expect(beforeCreateSpy).toHaveBeenCalledTimes(1)
            expect(beforeCreateSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'books::book.beforeCreate' }))
            expect(afterCreateSpy).toHaveBeenCalledTimes(1)
            expect(afterCreateSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'books::book.afterCreate' }))
            expect(beforeUpdateSpy).not.toHaveBeenCalled()
            expect(afterUpdateSpy).not.toHaveBeenCalled()
        })

        it('should trigger update events when upserting an existing record', async () => {
            // Create initial record
            const initial = { id: 42, title: 'Original Book', author: 'Original Author', publishedDate: new Date() }
            await repository.create(initial)

            // Clear create spies since they were called during setup
            beforeCreateSpy.mockClear()
            afterCreateSpy.mockClear()

            // Upsert existing record
            const update = { id: 42, title: 'Updated Book', author: 'Updated Author', publishedDate: new Date() }
            const upsertedRecord = await service.upsert(update)

            expect(upsertedRecord).toEqual(update)
            expect(beforeUpdateSpy).toHaveBeenCalledTimes(1)
            expect(beforeUpdateSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'books::book.beforeUpdate' }))
            expect(afterUpdateSpy).toHaveBeenCalledTimes(1)
            expect(afterUpdateSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'books::book.afterUpdate' }))
            expect(beforeCreateSpy).not.toHaveBeenCalled()
            expect(afterCreateSpy).not.toHaveBeenCalled()
        })

        it('should trigger create events when upserting with non-existent primary key', async () => {
            // Try to upsert with an ID that doesn't exist
            const input = { id: 999, title: 'Non-existent Book', author: 'Author Name', publishedDate: new Date() }

            const upsertedRecord = await service.upsert(input)

            expect(upsertedRecord).toEqual(input)
            expect(beforeCreateSpy).toHaveBeenCalledTimes(1)
            expect(beforeCreateSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'books::book.beforeCreate' }))
            expect(afterCreateSpy).toHaveBeenCalledTimes(1)
            expect(afterCreateSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'books::book.afterCreate' }))
            expect(beforeUpdateSpy).not.toHaveBeenCalled()
            expect(afterUpdateSpy).not.toHaveBeenCalled()
        })

        it('should handle multiple upserts correctly', async () => {
            // First upsert (create)
            const input1 = { id: 1, title: 'Book 1', author: 'Author 1', publishedDate: new Date() }
            const result1 = await service.upsert(input1)
            expect(result1).toEqual(input1)
            expect(await repository.load({ id: 1 })).toEqual(input1)

            // Second upsert (update)
            const input2 = { id: 1, title: 'Updated Book 1', author: 'Updated Author 1', publishedDate: new Date() }
            const result2 = await service.upsert(input2)
            expect(result2).toEqual(input2)
            expect(await repository.load({ id: 1 })).toEqual(input2)

            // Third upsert (create new)
            const input3 = { id: 2, title: 'Book 2', author: 'Author 2', publishedDate: new Date() }
            const result3 = await service.upsert(input3)
            expect(result3).toEqual(input3)
            expect(await repository.load({ id: 2 })).toEqual(input3)
        })

        it('should work with auto-generated IDs', async () => {
            const input1 = { title: 'Auto ID Book 1', author: 'Author 1', publishedDate: new Date() }
            const input2 = { title: 'Auto ID Book 2', author: 'Author 2', publishedDate: new Date() }

            const result1 = await service.upsert(input1)
            const result2 = await service.upsert(input2)

            expect(result1.id).toBeDefined()
            expect(result2.id).toBeDefined()
            expect(result1.id).not.toBe(result2.id)
            expect(result1.title).toBe(input1.title)
            expect(result2.title).toBe(input2.title)
        })
    })
})
