import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { MockBookSchema } from '../models/mock-book-models'
import { MockMemoryRepository } from './mock-memory-repository'
import { z } from 'zod/v4'
import { ZodModel } from '@declaro/zod'

describe('MockMemoryRepository', () => {
    const mockSchema = MockBookSchema

    let repository: MockMemoryRepository<typeof mockSchema>

    beforeEach(() => {
        repository = new MockMemoryRepository({ schema: mockSchema })
    })

    it('should create an item', async () => {
        const input = { id: 42, title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        const createdItem = await repository.create(input)

        expect(createdItem).toEqual(input)
        expect(await repository.load({ id: createdItem.id })).toEqual(createdItem)
    })

    it('should throw an error when creating an item with duplicate primary key', async () => {
        const input = { id: 42, title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        const createdItem = await repository.create(input)

        await expect(repository.create({ ...input, id: createdItem.id })).rejects.toThrow(
            'Item with the same primary key already exists',
        )
    })

    it('should update an existing item', async () => {
        const input = { id: 42, title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        const createdItem = await repository.create(input)

        const updatedInput = { title: 'Updated Book', author: 'Updated Author', publishedDate: new Date() }
        const updatedItem = await repository.update({ id: createdItem.id }, updatedInput)

        expect(updatedItem).toEqual({ id: createdItem.id, ...updatedInput })
        expect(await repository.load({ id: createdItem.id })).toEqual({ id: createdItem.id, ...updatedInput })
    })

    it('should throw an error when updating a non-existent item', async () => {
        const input = { id: 42, title: 'Test Book', author: 'Author Name', publishedDate: new Date() }

        await expect(repository.update({ id: 999 }, input)).rejects.toThrow('Item not found')
    })

    it('should remove an item', async () => {
        const input = { id: 42, title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        const createdItem = await repository.create(input)

        const removedItem = await repository.remove({ id: createdItem.id })

        expect(removedItem).toEqual(input)
        const loadedItem = await repository.load({ id: createdItem.id })
        expect(loadedItem).toBeNull()
    })

    it('should restore a removed item', async () => {
        const input = { id: 42, title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        const createdItem = await repository.create(input)
        await repository.remove({ id: createdItem.id })

        const restoredItem = await repository.restore({ id: createdItem.id })

        expect(restoredItem).toEqual(input)
        expect(await repository.load({ id: createdItem.id })).toEqual(input)
    })

    it('should throw an error when restoring a non-existent item', async () => {
        await expect(repository.restore({ id: 999 })).rejects.toThrow('Item not found in trash')
    })

    it('should allow me to create an item without a primary key', async () => {
        const input = { title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        const createdItem = await repository.create(input)

        expect(createdItem.id).toBeDefined()
        expect(createdItem.title).toBe(input.title)
        expect(createdItem.author).toBe(input.author)
        expect(await repository.load({ id: createdItem.id })).toEqual(createdItem)
    })

    it('should increment ids when creating items without a primary key', async () => {
        const input1 = { title: 'Test Book 1', author: 'Author Name 1', publishedDate: new Date() }
        const input2 = { title: 'Test Book 2', author: 'Author Name 2', publishedDate: new Date() }

        const createdItem1 = await repository.create(input1)
        const createdItem2 = await repository.create(input2)

        expect(createdItem1.id).toBe(1)
        expect(createdItem2.id).toBe(2)
        expect(await repository.load({ id: createdItem1.id })).toEqual(createdItem1)
        expect(await repository.load({ id: createdItem2.id })).toEqual(createdItem2)
    })

    it('should return null when loading a non-existent item', async () => {
        const result = await repository.load({ id: 999 })
        expect(result).toBeNull()
    })

    it('should be able to load items from a custom filter', async () => {
        // Creating a hypothetical schema with a custom filter, and a title lookup attribute
        const repository = new MockMemoryRepository({
            schema: mockSchema.custom({
                lookup: (h) =>
                    new ZodModel(
                        h.name,
                        z.object({
                            id: z.number().optional(),
                            title: z.string().optional(),
                        }),
                    ),
            }),
            lookup: (data, lookup) =>
                data.id === lookup.id || data.title?.toLowerCase() === lookup.title?.toLowerCase(),
        })

        const input = { title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        const createdItem = await repository.create(input)

        const loadedItem = await repository.load({ id: createdItem.id })
        const titleLoadedItem = await repository.load({ title: createdItem.title })
        expect(loadedItem).toEqual(createdItem)
        expect(titleLoadedItem).toEqual(createdItem)
    })
})
