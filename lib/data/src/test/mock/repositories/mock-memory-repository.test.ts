import { beforeEach, describe, expect, it } from 'bun:test'
import { MockBookSchema } from '../models/mock-book-models'
import { MockMemoryRepository } from './mock-memory-repository'

describe('MockMemoryRepository', () => {
    const primaryKey = 'id'
    const mockSchema = MockBookSchema

    let repository: MockMemoryRepository<typeof mockSchema>

    beforeEach(() => {
        repository = new MockMemoryRepository({ primaryKey, schema: mockSchema })
    })

    it('should create an item', async () => {
        const input = { id: 'generated-id', title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        const createdItem = await repository.create(input)

        expect(createdItem).toEqual(input)
        expect(await repository.load({ id: createdItem.id })).toEqual(createdItem)
    })

    it('should throw an error when creating an item with duplicate primary key', async () => {
        const input = { id: 'generated-id', title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        const createdItem = await repository.create(input)

        await expect(repository.create({ ...input, id: createdItem.id })).rejects.toThrow(
            'Item with the same primary key already exists',
        )
    })

    it('should update an existing item', async () => {
        const input = { id: 'generated-id', title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        const createdItem = await repository.create(input)

        const updatedInput = { title: 'Updated Book', author: 'Updated Author', publishedDate: new Date() }
        const updatedItem = await repository.update({ id: createdItem.id }, updatedInput)

        expect(updatedItem).toEqual({ id: createdItem.id, ...updatedInput })
        expect(await repository.load({ id: createdItem.id })).toEqual({ id: createdItem.id, ...updatedInput })
    })

    it('should throw an error when updating a non-existent item', async () => {
        const input = { id: 'generated-id', title: 'Test Book', author: 'Author Name', publishedDate: new Date() }

        await expect(repository.update({ id: 'non-existent-id' }, input)).rejects.toThrow('Item not found')
    })

    it('should remove an item', async () => {
        const input = { id: 'generated-id', title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        const createdItem = await repository.create(input)

        const removedItem = await repository.remove({ id: createdItem.id })

        expect(removedItem).toEqual(input)
        await expect(repository.load({ id: createdItem.id })).rejects.toThrow('Item not found')
    })

    it('should restore a removed item', async () => {
        const input = { id: 'generated-id', title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        const createdItem = await repository.create(input)
        await repository.remove({ id: createdItem.id })

        const restoredItem = await repository.restore({ id: createdItem.id })

        expect(restoredItem).toEqual(input)
        expect(await repository.load({ id: createdItem.id })).toEqual(input)
    })

    it('should throw an error when restoring a non-existent item', async () => {
        await expect(repository.restore({ id: 'non-existent-id' })).rejects.toThrow('Item not found in trash')
    })
})
