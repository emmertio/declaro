import { AuthValidator, getMockAuthSession, mockAuthConfig, MockAuthService } from '@declaro/auth'
import { EventManager, PermissionError } from '@declaro/core'
import { beforeEach, describe, expect, it } from 'bun:test'
import { ModelService } from '../domain/services/model-service'
import { MockBookSchema } from '../test/mock/models/mock-book-models'
import { MockMemoryRepository } from '../test/mock/repositories/mock-memory-repository'
import { ModelController } from './model-controller'

describe('ModelController', () => {
    const namespace = 'books'
    const mockSchema = MockBookSchema
    const authService = new MockAuthService(mockAuthConfig)

    let repository: MockMemoryRepository<typeof mockSchema>
    let service: ModelService<typeof mockSchema>
    let authValidator: AuthValidator
    let invalidAuthValidator: AuthValidator
    let readAuthValidator: AuthValidator

    beforeEach(() => {
        repository = new MockMemoryRepository({ schema: mockSchema })
        authValidator = new AuthValidator(
            getMockAuthSession({
                claims: ['books::book.write:all'],
            }),
            authService,
        )
        invalidAuthValidator = new AuthValidator(
            getMockAuthSession({
                claims: ['authors::author.write:all'],
            }),
            authService,
        )
        readAuthValidator = new AuthValidator(
            getMockAuthSession({
                claims: ['books::book.read:all'],
            }),
            authService,
        )
        service = new ModelService({
            repository,
            emitter: new EventManager(),
            schema: mockSchema,
            namespace,
        })
    })

    it('should create a record if permissions are valid', async () => {
        const controller = new ModelController(service, authValidator)

        const input = { id: 42, title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        const record = await controller.create(input)

        expect(record).toEqual(input)
    })

    it('should throw PermissionError if permissions are invalid for create', async () => {
        const controller = new ModelController(service, invalidAuthValidator)

        const input = { id: 42, title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        await expect(controller.create(input)).rejects.toThrow(PermissionError)
    })

    it('should update a record if permissions are valid', async () => {
        const controller = new ModelController(service, authValidator)

        const input = { id: 42, title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        await repository.create(input)

        const updatedInput = { title: 'Updated Title', author: 'Updated Author', publishedDate: new Date() }
        const updatedRecord = await controller.update({ id: 42 }, updatedInput)

        expect(updatedRecord).toEqual({ id: 42, ...updatedInput })
    })

    it('should throw PermissionError if permissions are invalid for update', async () => {
        const controller = new ModelController(service, invalidAuthValidator)

        const updatedInput = { title: 'Updated Title', author: 'Updated Author', publishedDate: new Date() }
        await expect(controller.update({ id: 42 }, updatedInput)).rejects.toThrow(PermissionError)
    })

    it('should remove a record if permissions are valid', async () => {
        const controller = new ModelController(service, authValidator)

        const input = { id: 42, title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        await repository.create(input)

        const removedRecord = await controller.remove({ id: 42 })

        expect(removedRecord).toEqual(input)
    })

    it('should throw PermissionError if permissions are invalid for remove', async () => {
        const controller = new ModelController(service, invalidAuthValidator)

        await expect(controller.remove({ id: 42 })).rejects.toThrow(PermissionError)
    })

    it('should restore a record if permissions are valid', async () => {
        const controller = new ModelController(service, authValidator)

        const input = { id: 42, title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        await repository.create(input)
        await service.remove({ id: 42 })

        const restoredRecord = await controller.restore({ id: 42 })

        expect(restoredRecord).toEqual(input)
    })

    it('should throw PermissionError if permissions are invalid for restore', async () => {
        const controller = new ModelController(service, invalidAuthValidator)

        await expect(controller.restore({ id: 42 })).rejects.toThrow(PermissionError)
    })

    // Test inherited search functionality from ReadOnlyModelController
    it('should search records with pagination and sorting', async () => {
        const controller = new ModelController(service, readAuthValidator)

        // Create test data
        const books = [
            { id: 1, title: 'Book A', author: 'Author 1', publishedDate: new Date('2020-01-01') },
            { id: 2, title: 'Book B', author: 'Author 2', publishedDate: new Date('2021-01-01') },
            { id: 3, title: 'Book C', author: 'Author 3', publishedDate: new Date('2022-01-01') },
        ]

        for (const book of books) {
            await repository.create(book)
        }

        // Test search with pagination
        const paginatedResult = await controller.search(
            {},
            {
                pagination: { page: 1, pageSize: 2 },
            },
        )

        expect(paginatedResult.results).toHaveLength(2)
        expect(paginatedResult.pagination.total).toBe(3)
        expect(paginatedResult.pagination.page).toBe(1)
        expect(paginatedResult.pagination.pageSize).toBe(2)

        // Test search with sorting
        const sortedResult = await controller.search(
            {},
            {
                sort: [{ title: 'desc' }],
            },
        )

        expect(sortedResult.results).toHaveLength(3)
        expect(sortedResult.results[0].title).toBe('Book C')
        expect(sortedResult.results[1].title).toBe('Book B')
        expect(sortedResult.results[2].title).toBe('Book A')

        // Test search with both pagination and sorting
        const combinedResult = await controller.search(
            {},
            {
                pagination: { page: 1, pageSize: 1 },
                sort: [{ title: 'desc' }],
            },
        )

        expect(combinedResult.results).toHaveLength(1)
        expect(combinedResult.results[0].title).toBe('Book C')
        expect(combinedResult.pagination.total).toBe(3)
    })

    it('should search records with filters', async () => {
        // Create a repository with a custom filter function for search
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
            emitter: new EventManager(),
            schema: mockSchema,
            namespace,
        })

        const controller = new ModelController(serviceWithFilter, readAuthValidator)

        // Create test data
        const books = [
            { id: 1, title: 'Test Book', author: 'Author 1', publishedDate: new Date('2020-01-01') },
            { id: 2, title: 'Another Book', author: 'Author 2', publishedDate: new Date('2021-01-01') },
        ]

        for (const book of books) {
            await repositoryWithFilter.create(book)
        }

        // Test search with filter
        const filteredResult = await controller.search({ text: 'Test' })

        expect(filteredResult.results).toHaveLength(1)
        expect(filteredResult.results[0].title).toBe('Test Book')
    })
})
