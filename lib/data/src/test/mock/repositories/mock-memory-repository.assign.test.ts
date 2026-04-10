import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { MockBookSchema } from '../models/mock-book-models'
import { MockMemoryRepository } from './mock-memory-repository'

describe('MockMemoryRepository - Assign Functionality', () => {
    const mockSchema = MockBookSchema

    let repository: MockMemoryRepository<typeof mockSchema>

    beforeEach(() => {
        repository = new MockMemoryRepository({ schema: mockSchema })
    })

    it('should use default Object.assign for create when no custom assign function is provided', async () => {
        const input = { title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        const createdItem = await repository.create(input)

        expect(createdItem).toMatchObject(input)
        expect(createdItem.id).toBeDefined()
    })

    it('should use default Object.assign for update when no custom assign function is provided', async () => {
        const input = { id: 42, title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        const createdItem = await repository.create(input)

        const updateInput = { title: 'Updated Book', author: 'Updated Author', publishedDate: new Date() }
        const updatedItem = await repository.update({ id: createdItem.id }, updateInput)

        expect(updatedItem).toEqual({
            id: createdItem.id,
            title: 'Updated Book',
            author: 'Updated Author',
            publishedDate: updateInput.publishedDate,
        })
    })

    it('should use default Object.assign for upsert when no custom assign function is provided', async () => {
        const input = { id: 42, title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        const upsertedItem = await repository.upsert(input)

        expect(upsertedItem).toEqual(input)

        const updateInput = { id: 42, title: 'Updated Book', author: 'Updated Author', publishedDate: new Date() }
        const updatedItem = await repository.upsert(updateInput)

        expect(updatedItem).toEqual(updateInput)
    })

    it('should use custom assign function for create operation', async () => {
        const customAssignMock = mock((existing: any, input: any) => ({
            ...existing,
            ...input,
            customField: 'custom_create_value',
        }))

        const customRepository = new MockMemoryRepository({
            schema: mockSchema,
            assign: customAssignMock,
        })

        const input = { title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        const createdItem = await customRepository.create(input)

        expect(customAssignMock).toHaveBeenCalledWith({}, input)
        expect((createdItem as any).customField).toBe('custom_create_value')
        expect(createdItem).toMatchObject(input)
    })

    it('should use custom assign function for update operation', async () => {
        const customAssignMock = mock((existing: any, input: any) => ({
            ...existing,
            ...input,
            customField: 'custom_update_value',
            lastModified: new Date('2023-01-01'),
        }))

        const customRepository = new MockMemoryRepository({
            schema: mockSchema,
            assign: customAssignMock,
        })

        const input = { id: 42, title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        const createdItem = await customRepository.create(input)

        const updateInput = { title: 'Updated Book', author: 'Updated Author', publishedDate: new Date() }
        const updatedItem = await customRepository.update({ id: createdItem.id }, updateInput)

        expect(customAssignMock).toHaveBeenCalledWith(createdItem, updateInput)
        expect((updatedItem as any).customField).toBe('custom_update_value')
        expect((updatedItem as any).lastModified).toEqual(new Date('2023-01-01'))
        expect(updatedItem.title).toBe('Updated Book')
    })

    it('should use custom assign function for upsert operation on existing item', async () => {
        const customAssignMock = mock((existing: any, input: any) => ({
            ...existing,
            ...input,
            mergeTimestamp: new Date('2023-01-01'),
            isUpserted: true,
        }))

        const customRepository = new MockMemoryRepository({
            schema: mockSchema,
            assign: customAssignMock,
        })

        const input = { id: 42, title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        const createdItem = await customRepository.create(input)

        const upsertInput = { id: 42, title: 'Upserted Book', author: 'Upserted Author', publishedDate: new Date() }
        const upsertedItem = await customRepository.upsert(upsertInput)

        // Should have been called twice: once for create, once for upsert
        expect(customAssignMock).toHaveBeenCalledTimes(2)
        expect(customAssignMock).toHaveBeenLastCalledWith(createdItem, upsertInput)
        expect((upsertedItem as any).mergeTimestamp).toEqual(new Date('2023-01-01'))
        expect((upsertedItem as any).isUpserted).toBe(true)
        expect(upsertedItem.title).toBe('Upserted Book')
    })

    it('should use custom assign function for upsert operation on new item', async () => {
        const customAssignMock = mock((existing: any, input: any) => ({
            ...existing,
            ...input,
            createdViaUpsert: true,
        }))

        const customRepository = new MockMemoryRepository({
            schema: mockSchema,
            assign: customAssignMock,
        })

        const input = { id: 42, title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        const upsertedItem = await customRepository.upsert(input)

        expect(customAssignMock).toHaveBeenCalledWith({}, input)
        expect((upsertedItem as any).createdViaUpsert).toBe(true)
        expect(upsertedItem).toMatchObject(input)
    })

    it('should use custom assign function for bulkUpsert operation', async () => {
        const customAssignMock = mock((existing: any, input: any) => ({
            ...existing,
            ...input,
            bulkProcessed: true,
        }))

        const customRepository = new MockMemoryRepository({
            schema: mockSchema,
            assign: customAssignMock,
        })

        const inputs = [
            { id: 1, title: 'Book 1', author: 'Author 1', publishedDate: new Date() },
            { id: 2, title: 'Book 2', author: 'Author 2', publishedDate: new Date() },
        ]

        const results = await customRepository.bulkUpsert(inputs)

        expect(customAssignMock).toHaveBeenCalledTimes(2)
        expect((results[0] as any).bulkProcessed).toBe(true)
        expect((results[1] as any).bulkProcessed).toBe(true)
        expect(results[0]).toMatchObject(inputs[0])
        expect(results[1]).toMatchObject(inputs[1])
    })

    it('should handle complex custom assign logic with conditional merging', async () => {
        const customAssign = (existing: any, input: any) => {
            const result = { ...existing, ...input }

            // Custom logic: preserve original author if input doesn't have one
            if (!input.author && existing.author) {
                result.author = existing.author
            }

            // Custom logic: track modification count
            result.modificationCount = (existing.modificationCount || 0) + 1

            return result
        }

        const customRepository = new MockMemoryRepository({
            schema: mockSchema,
            assign: customAssign,
        })

        const input = { id: 42, title: 'Test Book', author: 'Original Author', publishedDate: new Date() }
        const createdItem = await customRepository.create(input)

        expect((createdItem as any).modificationCount).toBe(1)

        // Update with partial data - use existing values for required fields
        const updateInput = {
            title: 'Updated Book',
            author: createdItem.author,
            publishedDate: createdItem.publishedDate,
        }
        const updatedItem = await customRepository.update({ id: createdItem.id }, updateInput)

        expect(updatedItem.author).toBe('Original Author')
        expect(updatedItem.title).toBe('Updated Book')
        expect((updatedItem as any).modificationCount).toBe(2)

        // Update with new author
        const updateWithAuthor = {
            title: updatedItem.title,
            author: 'New Author',
            publishedDate: updatedItem.publishedDate,
        }
        const finalItem = await customRepository.update({ id: createdItem.id }, updateWithAuthor)

        expect(finalItem.author).toBe('New Author')
        expect((finalItem as any).modificationCount).toBe(3)
    })
})
