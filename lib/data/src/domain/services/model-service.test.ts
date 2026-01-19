import { EventManager } from '@declaro/core'
import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { MockBookSchema } from '../../test/mock/models/mock-book-models'
import { MockMemoryRepository } from '../../test/mock/repositories/mock-memory-repository'
import { ModelService } from './model-service'

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

    describe('Trash Functionality', () => {
        const beforeEmptyTrashSpy = mock((event) => {})
        const afterEmptyTrashSpy = mock((event) => {})
        const beforePermanentlyDeleteFromTrashSpy = mock((event) => {})
        const afterPermanentlyDeleteFromTrashSpy = mock((event) => {})
        const beforePermanentlyDeleteSpy = mock((event) => {})
        const afterPermanentlyDeleteSpy = mock((event) => {})

        beforeEach(() => {
            emitter.on('books::book.beforeEmptyTrash', beforeEmptyTrashSpy)
            emitter.on('books::book.afterEmptyTrash', afterEmptyTrashSpy)
            emitter.on('books::book.beforePermanentlyDeleteFromTrash', beforePermanentlyDeleteFromTrashSpy)
            emitter.on('books::book.afterPermanentlyDeleteFromTrash', afterPermanentlyDeleteFromTrashSpy)
            emitter.on('books::book.beforePermanentlyDelete', beforePermanentlyDeleteSpy)
            emitter.on('books::book.afterPermanentlyDelete', afterPermanentlyDeleteSpy)

            beforeEmptyTrashSpy.mockClear()
            afterEmptyTrashSpy.mockClear()
            beforePermanentlyDeleteFromTrashSpy.mockClear()
            afterPermanentlyDeleteFromTrashSpy.mockClear()
            beforePermanentlyDeleteSpy.mockClear()
            afterPermanentlyDeleteSpy.mockClear()
        })

        describe('emptyTrash', () => {
            it('should permanently delete all items from trash', async () => {
                // Create and remove multiple items
                const book1 = await repository.create({
                    title: 'Book 1',
                    author: 'Author 1',
                    publishedDate: new Date(),
                })
                const book2 = await repository.create({
                    title: 'Book 2',
                    author: 'Author 2',
                    publishedDate: new Date(),
                })
                const book3 = await repository.create({
                    title: 'Book 3',
                    author: 'Author 3',
                    publishedDate: new Date(),
                })

                await repository.remove({ id: book1.id })
                await repository.remove({ id: book2.id })
                await repository.remove({ id: book3.id })

                // Empty trash
                const count = await service.emptyTrash()

                expect(count).toBe(3)

                // Verify items are no longer in trash
                const inTrash1 = await repository.load({ id: book1.id }, { removedOnly: true })
                const inTrash2 = await repository.load({ id: book2.id }, { removedOnly: true })
                const inTrash3 = await repository.load({ id: book3.id }, { removedOnly: true })

                expect(inTrash1).toBeNull()
                expect(inTrash2).toBeNull()
                expect(inTrash3).toBeNull()
            })

            it('should permanently delete filtered items from trash', async () => {
                const repositoryWithFilter = new MockMemoryRepository({
                    schema: mockSchema,
                    filter: (data, filters) => {
                        if (filters.text) {
                            return data.title.toLowerCase().includes(filters.text.toLowerCase())
                        }
                        return true
                    },
                })

                const serviceWithFilter = new ModelService({
                    repository: repositoryWithFilter,
                    emitter,
                    schema: mockSchema,
                    namespace,
                })

                const book1 = await repositoryWithFilter.create({
                    title: 'Test Book 1',
                    author: 'Author 1',
                    publishedDate: new Date(),
                })
                const book2 = await repositoryWithFilter.create({
                    title: 'Test Book 2',
                    author: 'Author 2',
                    publishedDate: new Date(),
                })
                const book3 = await repositoryWithFilter.create({
                    title: 'Other Book',
                    author: 'Author 3',
                    publishedDate: new Date(),
                })

                await repositoryWithFilter.remove({ id: book1.id })
                await repositoryWithFilter.remove({ id: book2.id })
                await repositoryWithFilter.remove({ id: book3.id })

                // Empty trash with filter
                const count = await serviceWithFilter.emptyTrash({ text: 'Test' })

                expect(count).toBe(2)

                // Verify only filtered items were deleted
                const inTrash1 = await repositoryWithFilter.load({ id: book1.id }, { removedOnly: true })
                const inTrash2 = await repositoryWithFilter.load({ id: book2.id }, { removedOnly: true })
                const inTrash3 = await repositoryWithFilter.load({ id: book3.id }, { removedOnly: true })

                expect(inTrash1).toBeNull()
                expect(inTrash2).toBeNull()
                expect(inTrash3).not.toBeNull()
                expect(inTrash3?.title).toBe('Other Book')
            })

            it('should return 0 when trash is empty', async () => {
                const count = await service.emptyTrash()
                expect(count).toBe(0)
            })

            it('should trigger before and after events for emptyTrash', async () => {
                const book = await repository.create({
                    title: 'Book to Remove',
                    author: 'Author',
                    publishedDate: new Date(),
                })
                await repository.remove({ id: book.id })

                await service.emptyTrash()

                expect(beforeEmptyTrashSpy).toHaveBeenCalledTimes(1)
                expect(beforeEmptyTrashSpy).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'books::book.beforeEmptyTrash' }),
                )
                expect(afterEmptyTrashSpy).toHaveBeenCalledTimes(1)
                expect(afterEmptyTrashSpy).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'books::book.afterEmptyTrash' }),
                )
            })

            it('should not affect non-removed items', async () => {
                await repository.create({ title: 'Active Book 1', author: 'Author 1', publishedDate: new Date() })
                await repository.create({ title: 'Active Book 2', author: 'Author 2', publishedDate: new Date() })

                const book3 = await repository.create({
                    title: 'Book to Remove',
                    author: 'Author 3',
                    publishedDate: new Date(),
                })
                await repository.remove({ id: book3.id })

                // Empty trash
                await service.emptyTrash()

                // Verify active items are still there
                const results = await repository.search({})
                expect(results.results).toHaveLength(2)
            })
        })

        describe('permanentlyDeleteFromTrash', () => {
            it('should permanently delete a removed item from trash', async () => {
                const book = await repository.create({
                    title: 'Book to Delete',
                    author: 'Author',
                    publishedDate: new Date(),
                })

                // Remove the book
                await repository.remove({ id: book.id })

                // Verify it's in trash
                const inTrash = await repository.load({ id: book.id }, { removedOnly: true })
                expect(inTrash).not.toBeNull()

                // Permanently delete from trash
                const deleted = await service.permanentlyDeleteFromTrash({ id: book.id })

                expect(deleted.id).toBe(book.id)
                expect(deleted.title).toBe('Book to Delete')

                // Verify it's no longer in trash
                const afterDelete = await repository.load({ id: book.id }, { removedOnly: true })
                expect(afterDelete).toBeNull()

                // Verify it's not in main data either
                const inMain = await repository.load({ id: book.id })
                expect(inMain).toBeNull()
            })

            it('should throw error when trying to delete non-existent item from trash', async () => {
                await expect(service.permanentlyDeleteFromTrash({ id: 999 })).rejects.toThrow()
            })

            it('should throw error when trying to delete active item from trash', async () => {
                const book = await repository.create({
                    title: 'Active Book',
                    author: 'Author',
                    publishedDate: new Date(),
                })

                // Should fail because item is not in trash
                await expect(service.permanentlyDeleteFromTrash({ id: book.id })).rejects.toThrow()
            })

            it('should trigger before and after events for permanentlyDeleteFromTrash', async () => {
                const book = await repository.create({
                    title: 'Book to Delete',
                    author: 'Author',
                    publishedDate: new Date(),
                })
                await repository.remove({ id: book.id })

                await service.permanentlyDeleteFromTrash({ id: book.id })

                expect(beforePermanentlyDeleteFromTrashSpy).toHaveBeenCalledTimes(1)
                expect(beforePermanentlyDeleteFromTrashSpy).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'books::book.beforePermanentlyDeleteFromTrash' }),
                )
                expect(afterPermanentlyDeleteFromTrashSpy).toHaveBeenCalledTimes(1)
                expect(afterPermanentlyDeleteFromTrashSpy).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'books::book.afterPermanentlyDeleteFromTrash' }),
                )
            })
        })

        describe('permanentlyDelete', () => {
            it('should permanently delete a removed item', async () => {
                const book = await repository.create({
                    title: 'Book to Delete',
                    author: 'Author',
                    publishedDate: new Date(),
                })

                // Remove the book first
                await repository.remove({ id: book.id })

                // Verify it's in trash
                const inTrash = await repository.load({ id: book.id }, { removedOnly: true })
                expect(inTrash).not.toBeNull()

                // Permanently delete
                const deleted = await service.permanentlyDelete({ id: book.id })

                expect(deleted.id).toBe(book.id)
                expect(deleted.title).toBe('Book to Delete')

                // Verify it's no longer anywhere
                const afterDelete = await repository.load({ id: book.id }, { removedOnly: true })
                expect(afterDelete).toBeNull()

                const inMain = await repository.load({ id: book.id })
                expect(inMain).toBeNull()
            })

            it('should permanently delete an active item', async () => {
                const book = await repository.create({
                    title: 'Active Book to Delete',
                    author: 'Author',
                    publishedDate: new Date(),
                })

                // Verify it exists
                const exists = await repository.load({ id: book.id })
                expect(exists).not.toBeNull()

                // Permanently delete without removing first
                const deleted = await service.permanentlyDelete({ id: book.id })

                expect(deleted.id).toBe(book.id)
                expect(deleted.title).toBe('Active Book to Delete')

                // Verify it's no longer in main data
                const afterDelete = await repository.load({ id: book.id })
                expect(afterDelete).toBeNull()

                // Verify it's not in trash either
                const inTrash = await repository.load({ id: book.id }, { removedOnly: true })
                expect(inTrash).toBeNull()
            })

            it('should throw error when trying to delete non-existent item', async () => {
                await expect(service.permanentlyDelete({ id: 999 })).rejects.toThrow()
            })

            it('should trigger before and after events for permanentlyDelete', async () => {
                const book = await repository.create({
                    title: 'Book to Delete',
                    author: 'Author',
                    publishedDate: new Date(),
                })

                await service.permanentlyDelete({ id: book.id })

                expect(beforePermanentlyDeleteSpy).toHaveBeenCalledTimes(1)
                expect(beforePermanentlyDeleteSpy).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'books::book.beforePermanentlyDelete' }),
                )
                expect(afterPermanentlyDeleteSpy).toHaveBeenCalledTimes(1)
                expect(afterPermanentlyDeleteSpy).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'books::book.afterPermanentlyDelete' }),
                )
            })
        })
    })

    describe('doNotDispatchEvents option', () => {
        const beforeLoadSpy = mock(() => {})
        const afterLoadSpy = mock(() => {})
        const beforeLoadManySpy = mock(() => {})
        const afterLoadManySpy = mock(() => {})

        beforeEach(() => {
            repository = new MockMemoryRepository({ schema: mockSchema })
            emitter = new EventManager()

            beforeLoadSpy.mockClear()
            afterLoadSpy.mockClear()
            beforeLoadManySpy.mockClear()
            afterLoadManySpy.mockClear()
            beforeCreateSpy.mockClear()
            afterCreateSpy.mockClear()
            beforeUpdateSpy.mockClear()
            afterUpdateSpy.mockClear()

            emitter.on('books::book.beforeLoad', beforeLoadSpy)
            emitter.on('books::book.afterLoad', afterLoadSpy)
            emitter.on('books::book.beforeLoadMany', beforeLoadManySpy)
            emitter.on('books::book.afterLoadMany', afterLoadManySpy)
            emitter.on('books::book.beforeCreate', beforeCreateSpy)
            emitter.on('books::book.afterCreate', afterCreateSpy)
            emitter.on('books::book.beforeUpdate', beforeUpdateSpy)
            emitter.on('books::book.afterUpdate', afterUpdateSpy)

            service = new ModelService({ repository, emitter, schema: mockSchema, namespace })
        })

        describe('upsert', () => {
            it('should not dispatch any events when doNotDispatchEvents is true', async () => {
                const input = {
                    id: 1,
                    title: 'Existing Book',
                    author: 'Author',
                    publishedDate: new Date(),
                }
                await repository.create(input)

                const updatedInput = {
                    id: 1,
                    title: 'Updated Book',
                    author: 'Updated Author',
                    publishedDate: new Date(),
                }

                await service.upsert(updatedInput, { doNotDispatchEvents: true })

                // Load events should not be dispatched due to propagation
                expect(beforeLoadSpy).not.toHaveBeenCalled()
                expect(afterLoadSpy).not.toHaveBeenCalled()

                // Update events should not be dispatched either
                expect(beforeUpdateSpy).not.toHaveBeenCalled()
                expect(afterUpdateSpy).not.toHaveBeenCalled()
            })

            it('should not dispatch load events even when doNotDispatchEvents is false', async () => {
                const input = {
                    id: 2,
                    title: 'Existing Book',
                    author: 'Author',
                    publishedDate: new Date(),
                }
                await repository.create(input)

                const updatedInput = {
                    id: 2,
                    title: 'Updated Book',
                    author: 'Updated Author',
                    publishedDate: new Date(),
                }

                await service.upsert(updatedInput, { doNotDispatchEvents: false })

                // Load events should NOT be dispatched (forced internally)
                expect(beforeLoadSpy).not.toHaveBeenCalled()
                expect(afterLoadSpy).not.toHaveBeenCalled()

                // Update events should be dispatched
                expect(beforeUpdateSpy).toHaveBeenCalledTimes(1)
                expect(afterUpdateSpy).toHaveBeenCalledTimes(1)
            })

            it('should not dispatch load events even when doNotDispatchEvents is not specified', async () => {
                const input = {
                    id: 3,
                    title: 'Existing Book',
                    author: 'Author',
                    publishedDate: new Date(),
                }
                await repository.create(input)

                const updatedInput = {
                    id: 3,
                    title: 'Updated Book',
                    author: 'Updated Author',
                    publishedDate: new Date(),
                }

                await service.upsert(updatedInput)

                // Load events should NOT be dispatched (forced internally)
                expect(beforeLoadSpy).not.toHaveBeenCalled()
                expect(afterLoadSpy).not.toHaveBeenCalled()

                // Update events should be dispatched
                expect(beforeUpdateSpy).toHaveBeenCalledTimes(1)
                expect(afterUpdateSpy).toHaveBeenCalledTimes(1)
            })
        })

        describe('bulkUpsert', () => {
            it('should not dispatch any events when doNotDispatchEvents is true', async () => {
                const input1 = {
                    id: 1,
                    title: 'Existing Book 1',
                    author: 'Author 1',
                    publishedDate: new Date(),
                }
                const input2 = {
                    id: 2,
                    title: 'Existing Book 2',
                    author: 'Author 2',
                    publishedDate: new Date(),
                }
                await repository.create(input1)
                await repository.create(input2)

                const updatedInputs = [
                    {
                        id: 1,
                        title: 'Updated Book 1',
                        author: 'Updated Author 1',
                        publishedDate: new Date(),
                    },
                    {
                        id: 2,
                        title: 'Updated Book 2',
                        author: 'Updated Author 2',
                        publishedDate: new Date(),
                    },
                ]

                await service.bulkUpsert(updatedInputs, { doNotDispatchEvents: true })

                // LoadMany events should not be dispatched due to propagation
                expect(beforeLoadManySpy).not.toHaveBeenCalled()
                expect(afterLoadManySpy).not.toHaveBeenCalled()

                // Update events should not be dispatched either
                expect(beforeUpdateSpy).not.toHaveBeenCalled()
                expect(afterUpdateSpy).not.toHaveBeenCalled()
            })

            it('should not dispatch loadMany events even when doNotDispatchEvents is false', async () => {
                const input1 = {
                    id: 3,
                    title: 'Existing Book 3',
                    author: 'Author 3',
                    publishedDate: new Date(),
                }
                const input2 = {
                    id: 4,
                    title: 'Existing Book 4',
                    author: 'Author 4',
                    publishedDate: new Date(),
                }
                await repository.create(input1)
                await repository.create(input2)

                const updatedInputs = [
                    {
                        id: 3,
                        title: 'Updated Book 3',
                        author: 'Updated Author 3',
                        publishedDate: new Date(),
                    },
                    {
                        id: 4,
                        title: 'Updated Book 4',
                        author: 'Updated Author 4',
                        publishedDate: new Date(),
                    },
                ]

                await service.bulkUpsert(updatedInputs, { doNotDispatchEvents: false })

                // LoadMany events should NOT be dispatched (forced internally)
                expect(beforeLoadManySpy).not.toHaveBeenCalled()
                expect(afterLoadManySpy).not.toHaveBeenCalled()

                // Update events should be dispatched (2 updates)
                expect(beforeUpdateSpy).toHaveBeenCalledTimes(2)
                expect(afterUpdateSpy).toHaveBeenCalledTimes(2)
            })

            it('should not dispatch loadMany events even when doNotDispatchEvents is not specified', async () => {
                const input1 = {
                    id: 5,
                    title: 'Existing Book 5',
                    author: 'Author 5',
                    publishedDate: new Date(),
                }
                const input2 = {
                    id: 6,
                    title: 'Existing Book 6',
                    author: 'Author 6',
                    publishedDate: new Date(),
                }
                await repository.create(input1)
                await repository.create(input2)

                const updatedInputs = [
                    {
                        id: 5,
                        title: 'Updated Book 5',
                        author: 'Updated Author 5',
                        publishedDate: new Date(),
                    },
                    {
                        id: 6,
                        title: 'Updated Book 6',
                        author: 'Updated Author 6',
                        publishedDate: new Date(),
                    },
                ]

                await service.bulkUpsert(updatedInputs)

                // LoadMany events should NOT be dispatched (forced internally)
                expect(beforeLoadManySpy).not.toHaveBeenCalled()
                expect(afterLoadManySpy).not.toHaveBeenCalled()

                // Update events should be dispatched (2 updates)
                expect(beforeUpdateSpy).toHaveBeenCalledTimes(2)
                expect(afterUpdateSpy).toHaveBeenCalledTimes(2)
            })

            it('should not dispatch any events with doNotDispatchEvents for mixed create and update operations', async () => {
                const existingInput = {
                    id: 7,
                    title: 'Existing Book',
                    author: 'Author',
                    publishedDate: new Date(),
                }
                await repository.create(existingInput)

                const inputs = [
                    {
                        id: 7,
                        title: 'Updated Book',
                        author: 'Updated Author',
                        publishedDate: new Date(),
                    },
                    {
                        id: 8,
                        title: 'New Book',
                        author: 'New Author',
                        publishedDate: new Date(),
                    },
                ]

                await service.bulkUpsert(inputs, { doNotDispatchEvents: true })

                // LoadMany events should not be dispatched
                expect(beforeLoadManySpy).not.toHaveBeenCalled()
                expect(afterLoadManySpy).not.toHaveBeenCalled()

                // Neither create nor update events should be dispatched
                expect(beforeCreateSpy).not.toHaveBeenCalled()
                expect(afterCreateSpy).not.toHaveBeenCalled()
                expect(beforeUpdateSpy).not.toHaveBeenCalled()
                expect(afterUpdateSpy).not.toHaveBeenCalled()
            })
        })
    })
})
