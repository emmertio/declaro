import { beforeEach, describe, expect, it } from 'bun:test'
import { MockBookSchema } from '../models/mock-book-models'
import { MockMemoryRepository } from './mock-memory-repository'

describe('MockMemoryRepository - Trash Functionality', () => {
    const mockSchema = MockBookSchema

    let repository: MockMemoryRepository<typeof mockSchema>

    beforeEach(() => {
        repository = new MockMemoryRepository({ schema: mockSchema })
    })

    describe('remove', () => {
        it('should be able to remove an item', async () => {
            // Create a test book
            const book = await repository.create({
                title: 'Book to Remove',
                author: 'Test Author',
                publishedDate: new Date(),
            })

            // Verify the book exists
            const loadedBook = await repository.load({ id: book.id })
            expect(loadedBook).not.toBeNull()
            expect(loadedBook?.title).toBe('Book to Remove')

            // Remove the book
            const removedBook = await repository.remove({ id: book.id })
            expect(removedBook.id).toBe(book.id)

            // Verify the book is no longer in the main data store
            const afterRemove = await repository.load({ id: book.id })
            expect(afterRemove).toBeNull()
        })

        it('should not be able to load a removed item by default', async () => {
            const book = await repository.create({
                title: 'Book to Remove',
                author: 'Test Author',
                publishedDate: new Date(),
            })

            await repository.remove({ id: book.id })

            // Default load should not find removed items
            const loadedBook = await repository.load({ id: book.id })
            expect(loadedBook).toBeNull()
        })
    })

    describe('load with removedOnly option', () => {
        it('should be able to load a removed item with removedOnly option', async () => {
            const book = await repository.create({
                title: 'Removed Book',
                author: 'Test Author',
                publishedDate: new Date(),
            })

            await repository.remove({ id: book.id })

            // Load with removedOnly should find the removed item
            const loadedBook = await repository.load({ id: book.id }, { removedOnly: true })
            expect(loadedBook).not.toBeNull()
            expect(loadedBook?.title).toBe('Removed Book')
        })

        it('should not load a non-removed item with removedOnly option', async () => {
            const book = await repository.create({
                title: 'Active Book',
                author: 'Test Author',
                publishedDate: new Date(),
            })

            // Load with removedOnly should not find active items
            const loadedBook = await repository.load({ id: book.id }, { removedOnly: true })
            expect(loadedBook).toBeNull()
        })
    })

    describe('load with includeRemoved option', () => {
        it('should be able to load a removed item with includeRemoved option', async () => {
            const book = await repository.create({
                title: 'Removed Book',
                author: 'Test Author',
                publishedDate: new Date(),
            })

            await repository.remove({ id: book.id })

            // Load with includeRemoved should find the removed item
            const loadedBook = await repository.load({ id: book.id }, { includeRemoved: true })
            expect(loadedBook).not.toBeNull()
            expect(loadedBook?.title).toBe('Removed Book')
        })

        it('should be able to load a non-removed item with includeRemoved option', async () => {
            const book = await repository.create({
                title: 'Active Book',
                author: 'Test Author',
                publishedDate: new Date(),
            })

            // Load with includeRemoved should find active items
            const loadedBook = await repository.load({ id: book.id }, { includeRemoved: true })
            expect(loadedBook).not.toBeNull()
            expect(loadedBook?.title).toBe('Active Book')
        })
    })

    describe('search with removedOnly option', () => {
        it('should be able to search removed items with removedOnly option', async () => {
            const repositoryWithFilter = new MockMemoryRepository({
                schema: mockSchema,
                filter: (data, filters) => {
                    if (filters.text) {
                        return data.title.toLowerCase().includes(filters.text.toLowerCase())
                    }
                    return true
                },
            })

            // Create test data
            await repositoryWithFilter.create({ title: 'Active Book 1', author: 'Author 1', publishedDate: new Date() })
            const removedBook1 = await repositoryWithFilter.create({
                title: 'Removed Book 1',
                author: 'Author 2',
                publishedDate: new Date(),
            })
            const removedBook2 = await repositoryWithFilter.create({
                title: 'Removed Book 2',
                author: 'Author 3',
                publishedDate: new Date(),
            })

            // Remove two books
            await repositoryWithFilter.remove({ id: removedBook1.id })
            await repositoryWithFilter.remove({ id: removedBook2.id })

            // Search with removedOnly should only find removed items
            const results = await repositoryWithFilter.search({}, { removedOnly: true })
            expect(results.results).toHaveLength(2)
            expect(results.results.every((book) => book.title.startsWith('Removed'))).toBe(true)
        })

        it('should be able to filter removed items with removedOnly option', async () => {
            const repositoryWithFilter = new MockMemoryRepository({
                schema: mockSchema,
                filter: (data, filters) => {
                    if (filters.text) {
                        return data.title.toLowerCase().includes(filters.text.toLowerCase())
                    }
                    return true
                },
            })

            // Create test data
            const removedBook1 = await repositoryWithFilter.create({
                title: 'Test Removed Book',
                author: 'Author 1',
                publishedDate: new Date(),
            })
            const removedBook2 = await repositoryWithFilter.create({
                title: 'Other Removed Book',
                author: 'Author 2',
                publishedDate: new Date(),
            })

            await repositoryWithFilter.remove({ id: removedBook1.id })
            await repositoryWithFilter.remove({ id: removedBook2.id })

            // Search with removedOnly and filter
            const results = await repositoryWithFilter.search({ text: 'Test' }, { removedOnly: true })
            expect(results.results).toHaveLength(1)
            expect(results.results[0].title).toBe('Test Removed Book')
        })

        it('should not return non-removed items with removedOnly option', async () => {
            const repositoryWithFilter = new MockMemoryRepository({
                schema: mockSchema,
                filter: (data, filters) => {
                    if (filters.text) {
                        return data.title.toLowerCase().includes(filters.text.toLowerCase())
                    }
                    return true
                },
            })

            // Create active items only
            await repositoryWithFilter.create({ title: 'Active Book 1', author: 'Author 1', publishedDate: new Date() })
            await repositoryWithFilter.create({ title: 'Active Book 2', author: 'Author 2', publishedDate: new Date() })

            // Search with removedOnly should return empty results
            const results = await repositoryWithFilter.search({}, { removedOnly: true })
            expect(results.results).toHaveLength(0)
        })
    })

    describe('search with includeRemoved option', () => {
        it('should be able to search both removed and non-removed items with includeRemoved option', async () => {
            const repositoryWithFilter = new MockMemoryRepository({
                schema: mockSchema,
                filter: (data, filters) => {
                    if (filters.text) {
                        return data.title.toLowerCase().includes(filters.text.toLowerCase())
                    }
                    return true
                },
            })

            // Create test data
            await repositoryWithFilter.create({ title: 'Active Book 1', author: 'Author 1', publishedDate: new Date() })
            await repositoryWithFilter.create({ title: 'Active Book 2', author: 'Author 2', publishedDate: new Date() })
            const removedBook = await repositoryWithFilter.create({
                title: 'Removed Book',
                author: 'Author 3',
                publishedDate: new Date(),
            })

            await repositoryWithFilter.remove({ id: removedBook.id })

            // Search with includeRemoved should find all items
            const results = await repositoryWithFilter.search({}, { includeRemoved: true })
            expect(results.results).toHaveLength(3)
        })

        it('should be able to filter across removed and non-removed items with includeRemoved option', async () => {
            const repositoryWithFilter = new MockMemoryRepository({
                schema: mockSchema,
                filter: (data, filters) => {
                    if (filters.text) {
                        return data.title.toLowerCase().includes(filters.text.toLowerCase())
                    }
                    return true
                },
            })

            // Create test data
            await repositoryWithFilter.create({
                title: 'Test Active Book',
                author: 'Author 1',
                publishedDate: new Date(),
            })
            const removedBook = await repositoryWithFilter.create({
                title: 'Test Removed Book',
                author: 'Author 2',
                publishedDate: new Date(),
            })
            await repositoryWithFilter.create({ title: 'Other Book', author: 'Author 3', publishedDate: new Date() })
            const otherRemovedBook = await repositoryWithFilter.create({
                title: 'Another Removed Book',
                author: 'Author 4',
                publishedDate: new Date(),
            })

            await repositoryWithFilter.remove({ id: removedBook.id })
            await repositoryWithFilter.remove({ id: otherRemovedBook.id })

            // Search with includeRemoved and filter
            const results = await repositoryWithFilter.search({ text: 'Test' }, { includeRemoved: true })
            expect(results.results).toHaveLength(2)
            expect(results.results.some((book) => book.title === 'Test Active Book')).toBe(true)
            expect(results.results.some((book) => book.title === 'Test Removed Book')).toBe(true)
        })
    })

    describe('permanentlyDeleteFromTrash', () => {
        it('should be able to permanently delete a previously removed item', async () => {
            const book = await repository.create({
                title: 'Book to Permanently Delete',
                author: 'Test Author',
                publishedDate: new Date(),
            })

            // Remove the book
            await repository.remove({ id: book.id })

            // Verify it's in trash
            const inTrash = await repository.load({ id: book.id }, { removedOnly: true })
            expect(inTrash).not.toBeNull()

            // Permanently delete from trash
            const deleted = await repository.permanentlyDeleteFromTrash({ id: book.id })
            expect(deleted.id).toBe(book.id)

            // Verify it's no longer in trash
            const afterDelete = await repository.load({ id: book.id }, { removedOnly: true })
            expect(afterDelete).toBeNull()

            // Verify it's not in main data either
            const inMain = await repository.load({ id: book.id })
            expect(inMain).toBeNull()
        })

        it('should throw error when trying to permanently delete non-existent item from trash', async () => {
            await expect(repository.permanentlyDeleteFromTrash({ id: 999 })).rejects.toThrow()
        })

        it('should throw error when trying to permanently delete a non-removed item from trash', async () => {
            const book = await repository.create({
                title: 'Active Book',
                author: 'Test Author',
                publishedDate: new Date(),
            })

            // Trying to permanently delete from trash without removing first should fail
            await expect(repository.permanentlyDeleteFromTrash({ id: book.id })).rejects.toThrow()
        })
    })

    describe('permanentlyDelete', () => {
        it('should be able to permanently delete a previously removed item', async () => {
            const book = await repository.create({
                title: 'Book to Permanently Delete',
                author: 'Test Author',
                publishedDate: new Date(),
            })

            // Remove the book
            await repository.remove({ id: book.id })

            // Verify it's in trash
            const inTrash = await repository.load({ id: book.id }, { removedOnly: true })
            expect(inTrash).not.toBeNull()

            // Permanently delete
            const deleted = await repository.permanentlyDelete({ id: book.id })
            expect(deleted.id).toBe(book.id)

            // Verify it's no longer anywhere
            const afterDelete = await repository.load({ id: book.id }, { removedOnly: true })
            expect(afterDelete).toBeNull()
        })

        it('should be able to permanently delete a non-removed item', async () => {
            const book = await repository.create({
                title: 'Active Book to Delete',
                author: 'Test Author',
                publishedDate: new Date(),
            })

            // Verify it exists
            const exists = await repository.load({ id: book.id })
            expect(exists).not.toBeNull()

            // Permanently delete without removing first
            const deleted = await repository.permanentlyDelete({ id: book.id })
            expect(deleted.id).toBe(book.id)

            // Verify it's no longer in main data
            const afterDelete = await repository.load({ id: book.id })
            expect(afterDelete).toBeNull()

            // Verify it's not in trash either
            const inTrash = await repository.load({ id: book.id }, { removedOnly: true })
            expect(inTrash).toBeNull()
        })

        it('should throw error when trying to permanently delete non-existent item', async () => {
            await expect(repository.permanentlyDelete({ id: 999 })).rejects.toThrow()
        })
    })

    describe('emptyTrash', () => {
        it('should permanently delete all items from trash when no filter is provided', async () => {
            // Create and remove multiple items
            const book1 = await repository.create({ title: 'Book 1', author: 'Author 1', publishedDate: new Date() })
            const book2 = await repository.create({ title: 'Book 2', author: 'Author 2', publishedDate: new Date() })
            const book3 = await repository.create({ title: 'Book 3', author: 'Author 3', publishedDate: new Date() })

            await repository.remove({ id: book1.id })
            await repository.remove({ id: book2.id })
            await repository.remove({ id: book3.id })

            // Verify all are in trash
            const trashResults = await repository.search({}, { removedOnly: true })
            expect(trashResults.results).toHaveLength(3)

            // Empty trash
            const deletedCount = await repository.emptyTrash()
            expect(deletedCount).toBe(3)

            // Verify trash is empty
            const afterEmpty = await repository.search({}, { removedOnly: true })
            expect(afterEmpty.results).toHaveLength(0)
        })

        it('should permanently delete filtered items from trash when filter is provided', async () => {
            const repositoryWithFilter = new MockMemoryRepository({
                schema: mockSchema,
                filter: (data, filters) => {
                    if (filters.text) {
                        return data.title.toLowerCase().includes(filters.text.toLowerCase())
                    }
                    return true
                },
            })

            // Create and remove multiple items
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
            const deletedCount = await repositoryWithFilter.emptyTrash({ text: 'Test' })
            expect(deletedCount).toBe(2)

            // Verify only filtered items were deleted
            const trashResults = await repositoryWithFilter.search({}, { removedOnly: true })
            expect(trashResults.results).toHaveLength(1)
            expect(trashResults.results[0].title).toBe('Other Book')
        })

        it('should return 0 when trash is already empty', async () => {
            const deletedCount = await repository.emptyTrash()
            expect(deletedCount).toBe(0)
        })

        it('should not affect non-removed items', async () => {
            // Create items
            await repository.create({ title: 'Active Book 1', author: 'Author 1', publishedDate: new Date() })
            await repository.create({ title: 'Active Book 2', author: 'Author 2', publishedDate: new Date() })

            const book3 = await repository.create({
                title: 'Book to Remove',
                author: 'Author 3',
                publishedDate: new Date(),
            })
            await repository.remove({ id: book3.id })

            // Empty trash
            await repository.emptyTrash()

            // Verify active items are still there
            const activeResults = await repository.search({})
            expect(activeResults.results).toHaveLength(2)
        })
    })

    describe('restore', () => {
        it('should restore a removed item back to active state', async () => {
            const book = await repository.create({
                title: 'Book to Restore',
                author: 'Test Author',
                publishedDate: new Date(),
            })

            // Remove the book
            await repository.remove({ id: book.id })

            // Verify it's in trash
            const inTrash = await repository.load({ id: book.id }, { removedOnly: true })
            expect(inTrash).not.toBeNull()

            // Restore the book
            const restored = await repository.restore({ id: book.id })
            expect(restored.id).toBe(book.id)

            // Verify it's back in main data
            const restoredBook = await repository.load({ id: book.id })
            expect(restoredBook).not.toBeNull()
            expect(restoredBook?.title).toBe('Book to Restore')

            // Verify it's no longer in trash
            const notInTrash = await repository.load({ id: book.id }, { removedOnly: true })
            expect(notInTrash).toBeNull()
        })

        it('should throw error when trying to restore non-existent item', async () => {
            await expect(repository.restore({ id: 999 })).rejects.toThrow('Item not found in trash')
        })

        it('should throw error when trying to restore a non-removed item', async () => {
            const book = await repository.create({
                title: 'Active Book',
                author: 'Test Author',
                publishedDate: new Date(),
            })

            // Trying to restore an active item should fail
            await expect(repository.restore({ id: book.id })).rejects.toThrow('Item not found in trash')
        })
    })

    describe('count with trash options', () => {
        it('should count only active items by default', async () => {
            const book1 = await repository.create({
                title: 'Active Book',
                author: 'Author 1',
                publishedDate: new Date(),
            })
            const book2 = await repository.create({
                title: 'Book to Remove',
                author: 'Author 2',
                publishedDate: new Date(),
            })

            await repository.remove({ id: book2.id })

            const count = await repository.count({})
            expect(count).toBe(1)
        })

        it('should count only removed items with removedOnly option', async () => {
            const book1 = await repository.create({
                title: 'Active Book',
                author: 'Author 1',
                publishedDate: new Date(),
            })
            const book2 = await repository.create({
                title: 'Book to Remove 1',
                author: 'Author 2',
                publishedDate: new Date(),
            })
            const book3 = await repository.create({
                title: 'Book to Remove 2',
                author: 'Author 3',
                publishedDate: new Date(),
            })

            await repository.remove({ id: book2.id })
            await repository.remove({ id: book3.id })

            const count = await repository.count({}, { removedOnly: true })
            expect(count).toBe(2)
        })

        it('should count both removed and active items with includeRemoved option', async () => {
            const book1 = await repository.create({
                title: 'Active Book',
                author: 'Author 1',
                publishedDate: new Date(),
            })
            const book2 = await repository.create({
                title: 'Book to Remove',
                author: 'Author 2',
                publishedDate: new Date(),
            })

            await repository.remove({ id: book2.id })

            const count = await repository.count({}, { includeRemoved: true })
            expect(count).toBe(2)
        })

        it('should count filtered active items by default', async () => {
            const repositoryWithFilter = new MockMemoryRepository({
                schema: mockSchema,
                filter: (data, filters) => {
                    if (filters.text) {
                        return data.title.toLowerCase().includes(filters.text.toLowerCase())
                    }
                    return true
                },
            })

            await repositoryWithFilter.create({ title: 'Test Book 1', author: 'Author 1', publishedDate: new Date() })
            await repositoryWithFilter.create({ title: 'Test Book 2', author: 'Author 2', publishedDate: new Date() })
            await repositoryWithFilter.create({ title: 'Other Book', author: 'Author 3', publishedDate: new Date() })
            const removedBook = await repositoryWithFilter.create({
                title: 'Test Book 3',
                author: 'Author 4',
                publishedDate: new Date(),
            })

            await repositoryWithFilter.remove({ id: removedBook.id })

            // Count with filter should only count active items matching filter
            const count = await repositoryWithFilter.count({ text: 'Test' })
            expect(count).toBe(2)
        })

        it('should count filtered removed items with removedOnly option', async () => {
            const repositoryWithFilter = new MockMemoryRepository({
                schema: mockSchema,
                filter: (data, filters) => {
                    if (filters.text) {
                        return data.title.toLowerCase().includes(filters.text.toLowerCase())
                    }
                    return true
                },
            })

            const book1 = await repositoryWithFilter.create({
                title: 'Test Removed Book 1',
                author: 'Author 1',
                publishedDate: new Date(),
            })
            const book2 = await repositoryWithFilter.create({
                title: 'Test Removed Book 2',
                author: 'Author 2',
                publishedDate: new Date(),
            })
            const book3 = await repositoryWithFilter.create({
                title: 'Other Removed Book',
                author: 'Author 3',
                publishedDate: new Date(),
            })
            await repositoryWithFilter.create({ title: 'Active Book', author: 'Author 4', publishedDate: new Date() })

            await repositoryWithFilter.remove({ id: book1.id })
            await repositoryWithFilter.remove({ id: book2.id })
            await repositoryWithFilter.remove({ id: book3.id })

            // Count with filter and removedOnly should only count removed items matching filter
            const count = await repositoryWithFilter.count({ text: 'Test' }, { removedOnly: true })
            expect(count).toBe(2)
        })

        it('should count filtered items across active and removed with includeRemoved option', async () => {
            const repositoryWithFilter = new MockMemoryRepository({
                schema: mockSchema,
                filter: (data, filters) => {
                    if (filters.text) {
                        return data.title.toLowerCase().includes(filters.text.toLowerCase())
                    }
                    return true
                },
            })

            await repositoryWithFilter.create({
                title: 'Test Active Book 1',
                author: 'Author 1',
                publishedDate: new Date(),
            })
            await repositoryWithFilter.create({
                title: 'Test Active Book 2',
                author: 'Author 2',
                publishedDate: new Date(),
            })
            const removedBook1 = await repositoryWithFilter.create({
                title: 'Test Removed Book 1',
                author: 'Author 3',
                publishedDate: new Date(),
            })
            const removedBook2 = await repositoryWithFilter.create({
                title: 'Test Removed Book 2',
                author: 'Author 4',
                publishedDate: new Date(),
            })
            await repositoryWithFilter.create({
                title: 'Other Active Book',
                author: 'Author 5',
                publishedDate: new Date(),
            })

            await repositoryWithFilter.remove({ id: removedBook1.id })
            await repositoryWithFilter.remove({ id: removedBook2.id })

            // Count with filter and includeRemoved should count all items matching filter
            const count = await repositoryWithFilter.count({ text: 'Test' }, { includeRemoved: true })
            expect(count).toBe(4)
        })

        it('should return 0 when no items match filter in active items', async () => {
            const repositoryWithFilter = new MockMemoryRepository({
                schema: mockSchema,
                filter: (data, filters) => {
                    if (filters.text) {
                        return data.title.toLowerCase().includes(filters.text.toLowerCase())
                    }
                    return true
                },
            })

            await repositoryWithFilter.create({ title: 'Active Book', author: 'Author 1', publishedDate: new Date() })

            const count = await repositoryWithFilter.count({ text: 'NonExistent' })
            expect(count).toBe(0)
        })

        it('should return 0 when no removed items match filter with removedOnly option', async () => {
            const repositoryWithFilter = new MockMemoryRepository({
                schema: mockSchema,
                filter: (data, filters) => {
                    if (filters.text) {
                        return data.title.toLowerCase().includes(filters.text.toLowerCase())
                    }
                    return true
                },
            })

            const book = await repositoryWithFilter.create({
                title: 'Removed Book',
                author: 'Author 1',
                publishedDate: new Date(),
            })
            await repositoryWithFilter.remove({ id: book.id })

            const count = await repositoryWithFilter.count({ text: 'NonExistent' }, { removedOnly: true })
            expect(count).toBe(0)
        })
    })
})
