import { describe, it, expect, beforeEach } from 'bun:test'
import { ModelService } from './model-service'
import { MockMemoryRepository } from '../../test/mock/repositories/mock-memory-repository'
import { MockBookSchema, type MockBookInput } from '../../test/mock/models/mock-book-models'
import { EventManager } from '@declaro/core'
import { mock } from 'bun:test'
import type { InferDetail, InferSummary } from '../../shared/utils/schema-inference'
import { ModelMutationAction } from '../events/event-types'

describe('ModelService - Normalization', () => {
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

    beforeEach(() => {
        emitter.on('books::book.beforeCreate', beforeCreateSpy)
        emitter.on('books::book.afterCreate', afterCreateSpy)

        beforeCreateSpy.mockClear()
        afterCreateSpy.mockClear()
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

            expect(beforeCreateCall.input.title).toBe('Test Book')
            expect(beforeCreateCall.input.author).toBe('Author Name')
            expect(beforeCreateCall.input.publishedDate).toEqual(new Date('2023-01-01'))

            expect(afterCreateCall.input.title).toBe('Test Book')
            expect(afterCreateCall.input.author).toBe('Author Name')
            expect(afterCreateCall.input.publishedDate).toEqual(new Date('2023-01-01'))
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

        describe('normalizeInput parameters verification', () => {
            let normalizeInputCalls: Array<{
                input: any
                existing?: any
                action: string
                scope: string
            }> = []

            class ParameterVerificationService extends ModelService<typeof mockSchema> {
                protected async normalizeInput(input: any, args: any) {
                    normalizeInputCalls.push({
                        input,
                        existing: args.existing,
                        action: args.descriptor.action,
                        scope: args.descriptor.scope,
                    })
                    return input
                }
            }

            let verificationService: ParameterVerificationService

            beforeEach(() => {
                normalizeInputCalls = []
                verificationService = new ParameterVerificationService({
                    repository,
                    emitter,
                    schema: mockSchema,
                    namespace,
                })
            })

            it('should pass correct descriptor and no existing entity for create operation', async () => {
                const input = { title: 'New Book', author: 'New Author', publishedDate: new Date() }

                await verificationService.create(input)

                expect(normalizeInputCalls).toHaveLength(1)
                expect(normalizeInputCalls[0].input).toEqual(input)
                expect(normalizeInputCalls[0].existing).toBeUndefined()
                expect(normalizeInputCalls[0].action).toBe('create')
                expect(normalizeInputCalls[0].scope).toBeUndefined()
            })

            it('should pass correct descriptor and existing entity for update operation', async () => {
                // First create a book
                const originalInput = {
                    id: 42,
                    title: 'Original Book',
                    author: 'Original Author',
                    publishedDate: new Date(),
                }
                await repository.create(originalInput)

                // Clear calls from create operation
                normalizeInputCalls = []

                // Now update it
                const updateInput = { title: 'Updated Book', author: 'Updated Author', publishedDate: new Date() }
                await verificationService.update({ id: 42 }, updateInput)

                expect(normalizeInputCalls).toHaveLength(1)
                expect(normalizeInputCalls[0].input).toEqual(updateInput)
                expect(normalizeInputCalls[0].existing).toEqual(originalInput)
                expect(normalizeInputCalls[0].action).toBe('update')
                expect(normalizeInputCalls[0].scope).toBeUndefined()
            })

            it('should pass correct descriptor and existing entity for upsert operation with existing record', async () => {
                // First create a book
                const originalInput = {
                    id: 42,
                    title: 'Original Book',
                    author: 'Original Author',
                    publishedDate: new Date(),
                }
                await repository.create(originalInput)

                // Clear calls from create operation
                normalizeInputCalls = []

                // Now upsert with same ID (update scenario)
                const upsertInput = {
                    id: 42,
                    title: 'Upserted Book',
                    author: 'Upserted Author',
                    publishedDate: new Date(),
                }
                await verificationService.upsert(upsertInput)

                expect(normalizeInputCalls).toHaveLength(1)
                expect(normalizeInputCalls[0].input).toEqual(upsertInput)
                expect(normalizeInputCalls[0].existing).toEqual(originalInput)
                expect(normalizeInputCalls[0].action).toBe('update')
                expect(normalizeInputCalls[0].scope).toBeUndefined()
            })

            it('should pass correct descriptor and no existing entity for upsert operation without existing record', async () => {
                const upsertInput = {
                    id: 42,
                    title: 'New Book via Upsert',
                    author: 'New Author',
                    publishedDate: new Date(),
                }

                await verificationService.upsert(upsertInput)

                expect(normalizeInputCalls).toHaveLength(1)
                expect(normalizeInputCalls[0].input).toEqual(upsertInput)
                // Note: repository.load returns null for non-existent records, not undefined
                expect(normalizeInputCalls[0].existing).toBeNull()
                expect(normalizeInputCalls[0].action).toBe('create')
                expect(normalizeInputCalls[0].scope).toBeUndefined()
            })

            it('should pass correct descriptor and no existing entity for upsert operation without primary key', async () => {
                const upsertInput = { title: 'Auto-ID Book', author: 'Auto Author', publishedDate: new Date() }

                await verificationService.upsert(upsertInput)

                expect(normalizeInputCalls).toHaveLength(1)
                expect(normalizeInputCalls[0].input).toEqual(upsertInput)
                expect(normalizeInputCalls[0].existing).toBeUndefined()
                expect(normalizeInputCalls[0].action).toBe('create')
                expect(normalizeInputCalls[0].scope).toBeUndefined()
            })

            it('should pass correct descriptors and existing entities for bulkUpsert operation with mixed scenarios', async () => {
                // Pre-create some books
                const existing1 = {
                    id: 1,
                    title: 'Existing Book 1',
                    author: 'Existing Author 1',
                    publishedDate: new Date('2023-01-01'),
                }
                const existing2 = {
                    id: 2,
                    title: 'Existing Book 2',
                    author: 'Existing Author 2',
                    publishedDate: new Date('2023-02-01'),
                }
                await repository.create(existing1)
                await repository.create(existing2)

                // Clear calls from create operations
                normalizeInputCalls = []

                // Now bulk upsert with mixed scenarios
                const bulkInputs = [
                    { id: 1, title: 'Updated Book 1', author: 'Updated Author 1', publishedDate: new Date() }, // Update existing
                    { id: 3, title: 'New Book 3', author: 'New Author 3', publishedDate: new Date() }, // Create with ID
                    { title: 'Auto Book', author: 'Auto Author', publishedDate: new Date() }, // Create without ID
                    { id: 2, title: 'Updated Book 2', author: 'Updated Author 2', publishedDate: new Date() }, // Update existing
                ]

                await verificationService.bulkUpsert(bulkInputs)

                expect(normalizeInputCalls).toHaveLength(4)

                // First input: update existing book with ID 1
                expect(normalizeInputCalls[0].input).toEqual(bulkInputs[0])
                expect(normalizeInputCalls[0].existing).toEqual(existing1)
                expect(normalizeInputCalls[0].action).toBe('update')
                expect(normalizeInputCalls[0].scope).toBeUndefined()

                // Second input: create new book with ID 3
                expect(normalizeInputCalls[1].input).toEqual(bulkInputs[1])
                expect(normalizeInputCalls[1].existing).toBeUndefined()
                expect(normalizeInputCalls[1].action).toBe('create')
                expect(normalizeInputCalls[1].scope).toBeUndefined()

                // Third input: create new book without ID
                expect(normalizeInputCalls[2].input).toEqual(bulkInputs[2])
                expect(normalizeInputCalls[2].existing).toBeUndefined()
                expect(normalizeInputCalls[2].action).toBe('create')
                expect(normalizeInputCalls[2].scope).toBeUndefined()

                // Fourth input: update existing book with ID 2
                expect(normalizeInputCalls[3].input).toEqual(bulkInputs[3])
                expect(normalizeInputCalls[3].existing).toEqual(existing2)
                expect(normalizeInputCalls[3].action).toBe('update')
                expect(normalizeInputCalls[3].scope).toBeUndefined()
            })

            it('should pass correct descriptors for bulkUpsert with duplicate primary keys', async () => {
                // Pre-create a book
                const existing = { id: 1, title: 'Existing Book', author: 'Existing Author', publishedDate: new Date() }
                await repository.create(existing)

                // Clear calls from create operation
                normalizeInputCalls = []

                // Bulk upsert with duplicate primary keys
                const bulkInputs = [
                    { id: 1, title: 'First Update', author: 'First Author', publishedDate: new Date() },
                    { id: 2, title: 'New Book', author: 'New Author', publishedDate: new Date() },
                    { id: 1, title: 'Second Update', author: 'Second Author', publishedDate: new Date() }, // Duplicate ID
                ]

                await verificationService.bulkUpsert(bulkInputs)

                expect(normalizeInputCalls).toHaveLength(3)

                // First input: update existing book with ID 1
                expect(normalizeInputCalls[0].input).toEqual(bulkInputs[0])
                expect(normalizeInputCalls[0].existing).toEqual(existing)
                expect(normalizeInputCalls[0].action).toBe('update')

                // Second input: create new book with ID 2
                expect(normalizeInputCalls[1].input).toEqual(bulkInputs[1])
                expect(normalizeInputCalls[1].existing).toBeUndefined()
                expect(normalizeInputCalls[1].action).toBe('create')

                // Third input: also update existing book with ID 1 (duplicate)
                expect(normalizeInputCalls[2].input).toEqual(bulkInputs[2])
                expect(normalizeInputCalls[2].existing).toEqual(existing)
                expect(normalizeInputCalls[2].action).toBe('update')
            })

            it('should handle bulkUpsert with only records without primary keys', async () => {
                const bulkInputs = [
                    { title: 'Auto Book 1', author: 'Auto Author 1', publishedDate: new Date() },
                    { title: 'Auto Book 2', author: 'Auto Author 2', publishedDate: new Date() },
                ]

                await verificationService.bulkUpsert(bulkInputs)

                expect(normalizeInputCalls).toHaveLength(2)

                // Both should be create operations with no existing entities
                expect(normalizeInputCalls[0].input).toEqual(bulkInputs[0])
                expect(normalizeInputCalls[0].existing).toBeUndefined()
                expect(normalizeInputCalls[0].action).toBe('create')

                expect(normalizeInputCalls[1].input).toEqual(bulkInputs[1])
                expect(normalizeInputCalls[1].existing).toBeUndefined()
                expect(normalizeInputCalls[1].action).toBe('create')
            })
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

            async normalizeSummary(summary: InferSummary<typeof mockSchema>): Promise<InferSummary<typeof mockSchema>> {
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
