import { describe, it, expect, beforeEach } from 'bun:test'
import { ModelService } from './model-service'
import { MockMemoryRepository } from '../../test/mock/repositories/mock-memory-repository'
import { MockBookSchema, type MockBookInput } from '../../test/mock/models/mock-book-models'
import { EventManager } from '@declaro/core'
import { mock } from 'bun:test'
import type { InferDetail } from '../../shared/utils/schema-inference'
import { ModelMutationAction } from '../events/event-types'

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

    describe('bulkUpsert functionality', () => {
        it('should handle empty input array', async () => {
            const results = await service.bulkUpsert([])
            expect(results).toEqual([])
        })

        it('should create multiple new records with explicit IDs', async () => {
            const inputs = [
                { id: 1, title: 'Book 1', author: 'Author 1', publishedDate: new Date('2023-01-01') },
                { id: 2, title: 'Book 2', author: 'Author 2', publishedDate: new Date('2023-02-01') },
                { id: 3, title: 'Book 3', author: 'Author 3', publishedDate: new Date('2023-03-01') },
            ]

            const results = await service.bulkUpsert(inputs)

            expect(results).toEqual(inputs)
            expect(results).toHaveLength(3)

            // Verify all records were created
            for (const input of inputs) {
                const loaded = await repository.load({ id: input.id })
                expect(loaded).toEqual(input)
            }
        })

        it('should update multiple existing records', async () => {
            // Create initial records
            const initialRecords = [
                { id: 1, title: 'Original Book 1', author: 'Original Author 1', publishedDate: new Date('2023-01-01') },
                { id: 2, title: 'Original Book 2', author: 'Original Author 2', publishedDate: new Date('2023-02-01') },
                { id: 3, title: 'Original Book 3', author: 'Original Author 3', publishedDate: new Date('2023-03-01') },
            ]

            for (const record of initialRecords) {
                await repository.create(record)
            }

            // Clear spies from creation
            beforeCreateSpy.mockClear()
            afterCreateSpy.mockClear()

            // Update all records
            const updateInputs = [
                { id: 1, title: 'Updated Book 1', author: 'Updated Author 1', publishedDate: new Date('2023-06-01') },
                { id: 2, title: 'Updated Book 2', author: 'Updated Author 2', publishedDate: new Date('2023-07-01') },
                { id: 3, title: 'Updated Book 3', author: 'Updated Author 3', publishedDate: new Date('2023-08-01') },
            ]

            const results = await service.bulkUpsert(updateInputs)

            expect(results).toEqual(updateInputs)
            expect(results).toHaveLength(3)

            // Verify all records were updated
            for (const input of updateInputs) {
                const loaded = await repository.load({ id: input.id })
                expect(loaded).toEqual(input)
            }
        })

        it('should handle mixed create and update operations', async () => {
            // Create some initial records
            const initialRecords = [
                { id: 1, title: 'Existing Book 1', author: 'Existing Author 1', publishedDate: new Date('2023-01-01') },
                { id: 3, title: 'Existing Book 3', author: 'Existing Author 3', publishedDate: new Date('2023-03-01') },
            ]

            for (const record of initialRecords) {
                await repository.create(record)
            }

            // Clear spies from creation
            beforeCreateSpy.mockClear()
            afterCreateSpy.mockClear()

            // Mix of updates and creates
            const mixedInputs = [
                { id: 1, title: 'Updated Book 1', author: 'Updated Author 1', publishedDate: new Date('2023-06-01') }, // Update
                { id: 2, title: 'New Book 2', author: 'New Author 2', publishedDate: new Date('2023-07-01') }, // Create
                { id: 3, title: 'Updated Book 3', author: 'Updated Author 3', publishedDate: new Date('2023-08-01') }, // Update
                { id: 4, title: 'New Book 4', author: 'New Author 4', publishedDate: new Date('2023-09-01') }, // Create
            ]

            const results = await service.bulkUpsert(mixedInputs)

            expect(results).toEqual(mixedInputs)
            expect(results).toHaveLength(4)

            // Verify all records exist with correct data
            for (const input of mixedInputs) {
                const loaded = await repository.load({ id: input.id })
                expect(loaded).toEqual(input)
            }
        })

        it('should handle records without primary keys (auto-generated IDs)', async () => {
            const inputsWithoutIds = [
                { title: 'Auto Book 1', author: 'Auto Author 1', publishedDate: new Date('2023-01-01') },
                { title: 'Auto Book 2', author: 'Auto Author 2', publishedDate: new Date('2023-02-01') },
            ]

            const results = await service.bulkUpsert(inputsWithoutIds)

            expect(results).toHaveLength(2)
            expect(results[0].id).toBeDefined()
            expect(results[1].id).toBeDefined()
            expect(results[0].id).not.toBe(results[1].id)
            expect(results[0].title).toBe(inputsWithoutIds[0].title)
            expect(results[1].title).toBe(inputsWithoutIds[1].title)

            // Verify records were created
            for (const result of results) {
                const loaded = await repository.load({ id: result.id })
                expect(loaded).toEqual(result)
            }
        })

        it('should handle mixed records with and without primary keys', async () => {
            // Create an existing record with a higher ID to avoid conflicts with auto-generated IDs
            const existingRecord = {
                id: 100,
                title: 'Existing Book',
                author: 'Existing Author',
                publishedDate: new Date('2023-01-01'),
            }
            await repository.create(existingRecord)

            // Clear spies from creation
            beforeCreateSpy.mockClear()
            afterCreateSpy.mockClear()

            const mixedInputs = [
                {
                    id: 100,
                    title: 'Updated Existing Book',
                    author: 'Updated Author',
                    publishedDate: new Date('2023-06-01'),
                }, // Update
                { id: 200, title: 'New Book with ID', author: 'New Author', publishedDate: new Date('2023-07-01') }, // Create with ID
                { title: 'Auto Book 1', author: 'Auto Author 1', publishedDate: new Date('2023-08-01') }, // Create without ID
                { title: 'Auto Book 2', author: 'Auto Author 2', publishedDate: new Date('2023-09-01') }, // Create without ID
            ]

            const results = await service.bulkUpsert(mixedInputs)

            expect(results).toHaveLength(4)

            // Results should be in the same order as inputs (repository preserves order)
            expect(results[0].id).toBe(100)
            expect(results[0].title).toBe('Updated Existing Book')

            expect(results[1].id).toBe(200)
            expect(results[1].title).toBe('New Book with ID')

            expect(results[2].id).toBeDefined()
            expect(results[2].title).toBe('Auto Book 1')

            expect(results[3].id).toBeDefined()
            expect(results[3].title).toBe('Auto Book 2')

            // Verify all records exist in repository
            const loadedRecord1 = await repository.load({ id: 100 })
            expect(loadedRecord1?.title).toBe('Updated Existing Book')

            const loadedRecord2 = await repository.load({ id: 200 })
            expect(loadedRecord2?.title).toBe('New Book with ID')

            const loadedRecord3 = await repository.load({ id: results[2].id })
            expect(loadedRecord3?.title).toBe('Auto Book 1')

            const loadedRecord4 = await repository.load({ id: results[3].id })
            expect(loadedRecord4?.title).toBe('Auto Book 2')
        })

        it('should trigger correct before and after events for bulk create operations', async () => {
            const inputs = [
                { id: 1, title: 'Book 1', author: 'Author 1', publishedDate: new Date() },
                { id: 2, title: 'Book 2', author: 'Author 2', publishedDate: new Date() },
            ]

            await service.bulkUpsert(inputs)

            expect(beforeCreateSpy).toHaveBeenCalledTimes(2)
            expect(afterCreateSpy).toHaveBeenCalledTimes(2)
            expect(beforeUpdateSpy).not.toHaveBeenCalled()
            expect(afterUpdateSpy).not.toHaveBeenCalled()

            // Verify event details
            expect(beforeCreateSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'books::book.beforeCreate' }))
            expect(afterCreateSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'books::book.afterCreate' }))
        })

        it('should trigger correct before and after events for bulk update operations', async () => {
            // Create initial records
            const initialRecords = [
                { id: 1, title: 'Original Book 1', author: 'Original Author 1', publishedDate: new Date() },
                { id: 2, title: 'Original Book 2', author: 'Original Author 2', publishedDate: new Date() },
            ]

            for (const record of initialRecords) {
                await repository.create(record)
            }

            // Clear spies from creation
            beforeCreateSpy.mockClear()
            afterCreateSpy.mockClear()

            // Update records
            const updateInputs = [
                { id: 1, title: 'Updated Book 1', author: 'Updated Author 1', publishedDate: new Date() },
                { id: 2, title: 'Updated Book 2', author: 'Updated Author 2', publishedDate: new Date() },
            ]

            await service.bulkUpsert(updateInputs)

            expect(beforeUpdateSpy).toHaveBeenCalledTimes(2)
            expect(afterUpdateSpy).toHaveBeenCalledTimes(2)
            expect(beforeCreateSpy).not.toHaveBeenCalled()
            expect(afterCreateSpy).not.toHaveBeenCalled()

            // Verify event details
            expect(beforeUpdateSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'books::book.beforeUpdate' }))
            expect(afterUpdateSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'books::book.afterUpdate' }))
        })

        it('should trigger correct before and after events for mixed operations', async () => {
            // Create one existing record
            const existingRecord = {
                id: 1,
                title: 'Existing Book',
                author: 'Existing Author',
                publishedDate: new Date(),
            }
            await repository.create(existingRecord)

            // Clear spies from creation
            beforeCreateSpy.mockClear()
            afterCreateSpy.mockClear()

            // Mix of update and create
            const mixedInputs = [
                { id: 1, title: 'Updated Book', author: 'Updated Author', publishedDate: new Date() }, // Update
                { id: 2, title: 'New Book', author: 'New Author', publishedDate: new Date() }, // Create
            ]

            await service.bulkUpsert(mixedInputs)

            expect(beforeCreateSpy).toHaveBeenCalledTimes(1)
            expect(afterCreateSpy).toHaveBeenCalledTimes(1)
            expect(beforeUpdateSpy).toHaveBeenCalledTimes(1)
            expect(afterUpdateSpy).toHaveBeenCalledTimes(1)
        })

        it('should trigger events for records without primary keys', async () => {
            const inputsWithoutIds = [
                { title: 'Auto Book 1', author: 'Auto Author 1', publishedDate: new Date() },
                { title: 'Auto Book 2', author: 'Auto Author 2', publishedDate: new Date() },
            ]

            await service.bulkUpsert(inputsWithoutIds)

            expect(beforeCreateSpy).toHaveBeenCalledTimes(2)
            expect(afterCreateSpy).toHaveBeenCalledTimes(2)
            expect(beforeUpdateSpy).not.toHaveBeenCalled()
            expect(afterUpdateSpy).not.toHaveBeenCalled()
        })

        it('should handle large batches efficiently', async () => {
            const batchSize = 100
            const inputs = Array.from({ length: batchSize }, (_, index) => ({
                id: index + 1,
                title: `Book ${index + 1}`,
                author: `Author ${index + 1}`,
                publishedDate: new Date(`2023-${String((index % 12) + 1).padStart(2, '0')}-01`),
            }))

            const startTime = Date.now()
            const results = await service.bulkUpsert(inputs)
            const endTime = Date.now()

            expect(results).toHaveLength(batchSize)
            expect(results).toEqual(inputs)

            // Verify events were triggered for all items
            expect(beforeCreateSpy).toHaveBeenCalledTimes(batchSize)
            expect(afterCreateSpy).toHaveBeenCalledTimes(batchSize)

            // Basic performance check - should complete in reasonable time
            expect(endTime - startTime).toBeLessThan(5000) // Less than 5 seconds

            // Verify a few random records
            const randomIndexes = [0, Math.floor(batchSize / 2), batchSize - 1]
            for (const index of randomIndexes) {
                const loaded = await repository.load({ id: inputs[index].id })
                expect(loaded).toEqual(inputs[index])
            }
        })

        it('should maintain data integrity when bulk upserting duplicate primary keys in input', async () => {
            // Input with duplicate IDs - last one should win
            const inputsWithDuplicates = [
                { id: 1, title: 'First Book 1', author: 'First Author 1', publishedDate: new Date('2023-01-01') },
                { id: 2, title: 'Book 2', author: 'Author 2', publishedDate: new Date('2023-02-01') },
                { id: 1, title: 'Last Book 1', author: 'Last Author 1', publishedDate: new Date('2023-03-01') }, // Duplicate ID
            ]

            const results = await service.bulkUpsert(inputsWithDuplicates)

            expect(results).toHaveLength(3)

            // The repository should handle duplicates according to its implementation
            // In our mock implementation, it processes them sequentially
            const finalRecord1 = await repository.load({ id: 1 })
            expect(finalRecord1?.title).toBe('Last Book 1') // Last write wins

            const record2 = await repository.load({ id: 2 })
            expect(record2?.title).toBe('Book 2')
        })

        it('should preserve order of results matching input order', async () => {
            const inputs = [
                { id: 3, title: 'Book 3', author: 'Author 3', publishedDate: new Date('2023-03-01') },
                { id: 1, title: 'Book 1', author: 'Author 1', publishedDate: new Date('2023-01-01') },
                { id: 2, title: 'Book 2', author: 'Author 2', publishedDate: new Date('2023-02-01') },
            ]

            const results = await service.bulkUpsert(inputs)

            expect(results).toHaveLength(3)
            expect(results[0].id).toBe(3)
            expect(results[1].id).toBe(1)
            expect(results[2].id).toBe(2)
            expect(results).toEqual(inputs)
        })
    })

    describe('normalizeInput functionality', () => {
        class TestModelService extends ModelService<typeof mockSchema> {
            public testNormalizeInput(input: any) {
                return this.normalizeInput(input)
            }

            protected async normalizeInput(input: MockBookInput): Promise<MockBookInput> {
                return {
                    ...input,
                    title: input.title?.trim(),
                    author: input.author?.trim(),
                    publishedDate: new Date('2023-01-01'),
                }
            }
        }

        let testService: TestModelService

        beforeEach(() => {
            testService = new TestModelService({ repository, emitter, schema: mockSchema, namespace })
        })

        it('should use default normalizeInput method (no changes) when not overridden', async () => {
            const input = { title: '  Test Book  ', author: '  Author Name  ', publishedDate: new Date() }
            const normalized = await service['normalizeInput'](input, {
                descriptor: service['getDescriptor'](ModelMutationAction.Create),
            })

            expect(normalized).toEqual(input)
            expect(normalized).toBe(input) // Should be the exact same reference
        })

        it('should use custom normalizeInput method for create operation', async () => {
            const input = { title: '  Test Book  ', author: '  Author Name  ', publishedDate: new Date() }
            const createdItem = await testService.create(input)

            expect(createdItem.title).toBe('Test Book')
            expect(createdItem.author).toBe('Author Name')
            expect(createdItem.publishedDate).toEqual(new Date('2023-01-01'))
        })

        it('should use custom normalizeInput method for update operation', async () => {
            const input = { id: 42, title: 'Original Book', author: 'Original Author', publishedDate: new Date() }
            const createdItem = await testService.create(input)

            const updateInput = { title: '  Updated Book  ', author: '  Updated Author  ', publishedDate: new Date() }
            const updatedItem = await testService.update({ id: createdItem.id }, updateInput)

            expect(updatedItem.title).toBe('Updated Book')
            expect(updatedItem.author).toBe('Updated Author')
            expect(updatedItem.publishedDate).toEqual(new Date('2023-01-01'))
        })

        it('should use custom normalizeInput method for upsert operation', async () => {
            const input = { id: 42, title: '  Test Book  ', author: '  Author Name  ', publishedDate: new Date() }
            const upsertedItem = await testService.upsert(input)

            expect(upsertedItem.title).toBe('Test Book')
            expect(upsertedItem.author).toBe('Author Name')
            expect(upsertedItem.publishedDate).toEqual(new Date('2023-01-01'))

            // Upsert again with different data
            const updateInput = {
                id: 42,
                title: '  Updated Book  ',
                author: '  Updated Author  ',
                publishedDate: new Date(),
            }
            const updatedItem = await testService.upsert(updateInput)

            expect(updatedItem.title).toBe('Updated Book')
            expect(updatedItem.author).toBe('Updated Author')
            expect(updatedItem.publishedDate).toEqual(new Date('2023-01-01'))
        })

        it('should use custom normalizeInput method for bulkUpsert operation', async () => {
            const inputs = [
                { id: 1, title: '  Book One  ', author: '  Author One  ', publishedDate: new Date() },
                { id: 2, title: '  Book Two  ', author: '  Author Two  ', publishedDate: new Date() },
                { title: '  Book Three  ', author: '  Author Three  ', publishedDate: new Date() }, // No ID - will be created
            ]

            const results = await testService.bulkUpsert(inputs)

            expect(results).toHaveLength(3)
            expect(results[0].title).toBe('Book One')
            expect(results[0].author).toBe('Author One')
            expect(results[0].publishedDate).toEqual(new Date('2023-01-01'))

            expect(results[1].title).toBe('Book Two')
            expect(results[1].author).toBe('Author Two')
            expect(results[1].publishedDate).toEqual(new Date('2023-01-01'))

            expect(results[2].title).toBe('Book Three')
            expect(results[2].author).toBe('Author Three')
            expect(results[2].publishedDate).toEqual(new Date('2023-01-01'))
        })

        it('should preserve events order with normalized input in create operation', async () => {
            const input = { title: '  Test Book  ', author: '  Author Name  ', publishedDate: new Date() }
            await testService.create(input)

            // Debug: Let's see what was actually called
            const beforeCreateCall = beforeCreateSpy.mock.calls[0][0]
            const afterCreateCall = afterCreateSpy.mock.calls[0][0]

            expect(beforeCreateCall.meta.input.title).toBe('Test Book')
            expect(beforeCreateCall.meta.input.author).toBe('Author Name')
            expect(beforeCreateCall.meta.input.publishedDate).toEqual(new Date('2023-01-01'))

            expect(afterCreateCall.meta.input.title).toBe('Test Book')
            expect(afterCreateCall.meta.input.author).toBe('Author Name')
            expect(afterCreateCall.meta.input.publishedDate).toEqual(new Date('2023-01-01'))
        })

        it('should call normalizeInput method exactly once per input during bulkUpsert with Promise.all', async () => {
            const normalizeInputSpy = mock(async (input: any) => ({ ...input, normalized: true }))

            class SpyService extends ModelService<typeof mockSchema> {
                protected async normalizeInput(input: any) {
                    return normalizeInputSpy(input)
                }
            }

            const spyService = new SpyService({ repository, emitter, schema: mockSchema, namespace })

            const inputs = [
                { id: 1, title: 'Book One', author: 'Author One', publishedDate: new Date() },
                { id: 2, title: 'Book Two', author: 'Author Two', publishedDate: new Date() },
            ]

            await spyService.bulkUpsert(inputs)

            expect(normalizeInputSpy).toHaveBeenCalledTimes(2)
            expect(normalizeInputSpy).toHaveBeenNthCalledWith(1, inputs[0])
            expect(normalizeInputSpy).toHaveBeenNthCalledWith(2, inputs[1])
        })

        it('should handle async normalization errors gracefully', async () => {
            class ErrorNormalizationService extends ModelService<typeof mockSchema> {
                protected async normalizeInput(input: any) {
                    if (input.title === 'ERROR') {
                        throw new Error('Normalization failed')
                    }
                    return input
                }
            }

            const errorService = new ErrorNormalizationService({
                repository,
                emitter,
                schema: mockSchema,
                namespace,
            })

            const input = { title: 'ERROR', author: 'Author Name', publishedDate: new Date() }

            await expect(errorService.create(input)).rejects.toThrow('Normalization failed')
        })

        it('should process bulk normalization in parallel for performance', async () => {
            const processingTimes: number[] = []

            class TimingNormalizationService extends ModelService<typeof mockSchema> {
                protected async normalizeInput(input: any) {
                    const start = Date.now()
                    // Simulate some async work
                    await new Promise((resolve) => setTimeout(resolve, 50))
                    processingTimes.push(Date.now() - start)
                    return input
                }
            }

            const timingService = new TimingNormalizationService({
                repository,
                emitter,
                schema: mockSchema,
                namespace,
            })

            const inputs = [
                { id: 1, title: 'Book One', author: 'Author One', publishedDate: new Date() },
                { id: 2, title: 'Book Two', author: 'Author Two', publishedDate: new Date() },
                { id: 3, title: 'Book Three', author: 'Author Three', publishedDate: new Date() },
            ]

            const start = Date.now()
            await timingService.bulkUpsert(inputs)
            const totalTime = Date.now() - start

            // With Promise.all, total time should be closer to single operation time rather than sum of all
            // Allow some variance for test stability
            expect(totalTime).toBeLessThan(150) // Much less than 3 * 50ms = 150ms
            expect(processingTimes).toHaveLength(3)
        })
    })

    describe('Response Normalization', () => {
        class TestRepository extends MockMemoryRepository<typeof mockSchema> {
            constructor() {
                super({
                    schema: mockSchema,
                })
            }

            async create(input: MockBookInput): Promise<any> {
                const record = await super.create(input)
                // Return with publishedDate as string to test normalization
                record.publishedDate = '2024-01-01' as any
                return record
            }

            async update(lookup: any, input: MockBookInput): Promise<any> {
                const record = await super.update(lookup, input)
                // Return with publishedDate as string to test normalization
                record.publishedDate = '2024-01-01' as any
                return record
            }

            async upsert(input: MockBookInput): Promise<any> {
                const record = await super.upsert(input)
                // Return with publishedDate as string to test normalization
                record.publishedDate = '2024-01-01' as any
                return record
            }

            async bulkUpsert(inputs: MockBookInput[]): Promise<any[]> {
                const records = await super.bulkUpsert(inputs)
                // Return with publishedDate as string to test normalization
                for (const record of records) {
                    record.publishedDate = '2024-01-01' as any
                }
                return records
            }

            async remove(lookup: any): Promise<any> {
                const record = await super.remove(lookup)
                // Return with publishedDate as string to test normalization
                if (record) {
                    record.publishedDate = '2024-01-01' as any
                }
                return record
            }

            async restore(lookup: any): Promise<any> {
                const record = await super.restore(lookup)
                // Return with publishedDate as string to test normalization
                if (record) {
                    record.publishedDate = '2024-01-01' as any
                }
                return record
            }
        }

        class TestServiceWithNormalization extends ModelService<typeof mockSchema> {
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

        let testRepository: TestRepository
        let testService: TestServiceWithNormalization

        beforeEach(() => {
            testRepository = new TestRepository()
            emitter = new EventManager()

            testService = new TestServiceWithNormalization({
                repository: testRepository,
                emitter,
                schema: mockSchema,
                namespace,
            })
        })

        it('should allow custom normalization of details in the create response when overridden', async () => {
            const input = { id: 200, title: 'Create Test', author: 'Creator', publishedDate: new Date() }
            const record = await testService.create(input)

            const expectedDate = new Date('2024-01-01')
            const actualDate = record.publishedDate

            expect(actualDate).toEqual(expectedDate)
            expect(actualDate).toBeInstanceOf(Date)
        })

        it('should allow custom normalization of details in the update response when overridden', async () => {
            const input = { id: 201, title: 'Update Test', author: 'Updater', publishedDate: new Date() }
            await testRepository.create(input)

            const updatedInput = { title: 'Updated Test', author: 'Updated Author', publishedDate: new Date() }
            const record = await testService.update({ id: 201 }, updatedInput)

            const expectedDate = new Date('2024-01-01')
            const actualDate = record.publishedDate

            expect(actualDate).toEqual(expectedDate)
            expect(actualDate).toBeInstanceOf(Date)
        })

        it('should allow custom normalization of details in the upsert response when creating and overridden', async () => {
            const input = { id: 202, title: 'Upsert Create Test', author: 'Upserter', publishedDate: new Date() }
            const record = await testService.upsert(input)

            const expectedDate = new Date('2024-01-01')
            const actualDate = record.publishedDate

            expect(actualDate).toEqual(expectedDate)
            expect(actualDate).toBeInstanceOf(Date)
        })

        it('should allow custom normalization of details in the upsert response when updating and overridden', async () => {
            const input = { id: 203, title: 'Upsert Update Test', author: 'Upserter', publishedDate: new Date() }
            await testRepository.create(input)

            const updatedInput = {
                id: 203,
                title: 'Updated Upsert Test',
                author: 'Updated Upserter',
                publishedDate: new Date(),
            }
            const record = await testService.upsert(updatedInput)

            const expectedDate = new Date('2024-01-01')
            const actualDate = record.publishedDate

            expect(actualDate).toEqual(expectedDate)
            expect(actualDate).toBeInstanceOf(Date)
        })

        it('should allow custom normalization of details in the bulkUpsert response when overridden', async () => {
            const input1 = { id: 204, title: 'Bulk Test 1', author: 'Bulk Author 1', publishedDate: new Date() }
            const input2 = { id: 205, title: 'Bulk Test 2', author: 'Bulk Author 2', publishedDate: new Date() }

            const records = await testService.bulkUpsert([input1, input2])

            const expectedDate = new Date('2024-01-01')

            for (const record of records) {
                const actualDate = record.publishedDate
                expect(actualDate).toEqual(expectedDate)
                expect(actualDate).toBeInstanceOf(Date)
            }
        })

        it('should allow custom normalization of details in the bulkUpsert response with mixed create and update when overridden', async () => {
            const existingInput = { id: 206, title: 'Existing', author: 'Existing Author', publishedDate: new Date() }
            await testRepository.create(existingInput)

            const updateInput = {
                id: 206,
                title: 'Updated Existing',
                author: 'Updated Author',
                publishedDate: new Date(),
            }
            const createInput = { id: 207, title: 'New Record', author: 'New Author', publishedDate: new Date() }

            const records = await testService.bulkUpsert([updateInput, createInput])

            const expectedDate = new Date('2024-01-01')

            for (const record of records) {
                const actualDate = record.publishedDate
                expect(actualDate).toEqual(expectedDate)
                expect(actualDate).toBeInstanceOf(Date)
            }
        })

        it('should allow custom normalization of summaries in the remove response when overridden', async () => {
            const input = { id: 208, title: 'Remove Test', author: 'Remover', publishedDate: new Date() }
            await testRepository.create(input)

            const record = await testService.remove({ id: 208 })

            const expectedDate = new Date('2024-01-01')
            const actualDate = record.publishedDate

            expect(actualDate).toEqual(expectedDate)
            expect(actualDate).toBeInstanceOf(Date)
        })

        it('should allow custom normalization of summaries in the restore response when overridden', async () => {
            const input = { id: 209, title: 'Restore Test', author: 'Restorer', publishedDate: new Date() }
            await testRepository.create(input)
            await testRepository.remove({ id: 209 })

            const record = await testService.restore({ id: 209 })

            const expectedDate = new Date('2024-01-01')
            const actualDate = record.publishedDate

            expect(actualDate).toEqual(expectedDate)
            expect(actualDate).toBeInstanceOf(Date)
        })

        it('should not normalize data by default when normalization methods are not overridden', async () => {
            const defaultService = new ModelService({
                repository: testRepository,
                emitter,
                schema: mockSchema,
                namespace,
            })

            const input = { id: 210, title: 'Default Test', author: 'Default Author', publishedDate: new Date() }
            const record = await defaultService.create(input)

            // Should return the raw string from repository since no normalization is applied
            expect(record.publishedDate as any).toBe('2024-01-01')
            expect(typeof record.publishedDate).toBe('string')
        })
    })
})
