import { AuthValidator, getMockAuthSession, mockAuthConfig, MockAuthService } from '@declaro/auth'
import { EventManager, PermissionError } from '@declaro/core'
import { beforeEach, describe, expect, it } from 'bun:test'
import { ReadOnlyModelService } from '../domain/services/read-only-model-service'
import { MockBookSchema } from '../test/mock/models/mock-book-models'
import { MockMemoryRepository } from '../test/mock/repositories/mock-memory-repository'
import { ReadOnlyModelController } from './read-only-model-controller'

describe('ReadOnlyModelController', () => {
    const namespace = 'books'
    const mockSchema = MockBookSchema
    const authService = new MockAuthService(mockAuthConfig)

    let repository: MockMemoryRepository<typeof mockSchema>
    let service: ReadOnlyModelService<typeof mockSchema>
    let authValidator: AuthValidator
    let invalidAuthValidator: AuthValidator

    beforeEach(() => {
        repository = new MockMemoryRepository({ schema: mockSchema })
        authValidator = new AuthValidator(
            getMockAuthSession({
                claims: ['books::book.read:all'],
            }),
            authService,
        )
        invalidAuthValidator = new AuthValidator(
            getMockAuthSession({
                claims: ['authors::author.read:all'],
            }),
            authService,
        )
        service = new ReadOnlyModelService({
            repository,
            emitter: new EventManager(),
            schema: mockSchema,
            namespace,
        })
    })

    it('should load a single record if permissions are valid', async () => {
        const controller = new ReadOnlyModelController(service, authValidator)

        const input = { id: 42, title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        await repository.create(input)

        const record = await controller.load({ id: 42 })

        expect(record).toEqual(input)
    })

    it('should throw PermissionError if permissions are invalid for load', async () => {
        const controller = new ReadOnlyModelController(service, invalidAuthValidator)

        await expect(controller.load({ id: 42 })).rejects.toThrow(PermissionError)
    })

    it('should load multiple records if permissions are valid', async () => {
        const controller = new ReadOnlyModelController(service, authValidator)

        const input1 = { id: 42, title: 'Test Book 1', author: 'Author Name 1', publishedDate: new Date() }
        const input2 = { id: 43, title: 'Test Book 2', author: 'Author Name 2', publishedDate: new Date() }
        await repository.create(input1)
        await repository.create(input2)

        const records = await controller.loadMany([{ id: 42 }, { id: 43 }])

        expect(records).toEqual([input1, input2])
    })

    it('should throw PermissionError if permissions are invalid for loadMany', async () => {
        const controller = new ReadOnlyModelController(service, invalidAuthValidator)

        await expect(controller.loadMany([{ id: 42 }, { id: 43 }])).rejects.toThrow(PermissionError)
    })

    it('should search for records if permissions are valid', async () => {
        const controller = new ReadOnlyModelController(service, authValidator)

        const input1 = { id: 42, title: 'Test Book 1', author: 'Author Name 1', publishedDate: new Date() }
        const input2 = { id: 43, title: 'Test Book 2', author: 'Author Name 2', publishedDate: new Date() }
        await repository.create(input1)
        await repository.create(input2)

        const results = await controller.search({ text: 'Test' })

        expect(results.results).toEqual([input1, input2])
        expect(results.pagination.total).toBe(2)
    })

    it('should throw PermissionError if permissions are invalid for search', async () => {
        const controller = new ReadOnlyModelController(service, invalidAuthValidator)

        await expect(controller.search({ text: 'Test' })).rejects.toThrow(PermissionError)
    })

    it('should handle search with pagination options', async () => {
        const controller = new ReadOnlyModelController(service, authValidator)

        // Create 5 items
        for (let i = 1; i <= 5; i++) {
            await repository.create({
                id: i,
                title: `Test Book ${i}`,
                author: `Author ${i}`,
                publishedDate: new Date(),
            })
        }

        const results = await controller.search(
            {},
            {
                pagination: { page: 1, pageSize: 2 },
            },
        )

        expect(results.results).toHaveLength(2)
        expect(results.pagination.page).toBe(1)
        expect(results.pagination.pageSize).toBe(2)
        expect(results.pagination.total).toBe(5)
        expect(results.pagination.totalPages).toBe(3)
    })

    it('should handle search with sort options', async () => {
        const controller = new ReadOnlyModelController(service, authValidator)

        const input1 = { id: 1, title: 'Z Book', author: 'Author A', publishedDate: new Date() }
        const input2 = { id: 2, title: 'A Book', author: 'Author B', publishedDate: new Date() }
        await repository.create(input1)
        await repository.create(input2)

        const results = await controller.search(
            {},
            {
                sort: [{ title: 'asc' }],
            },
        )

        expect(results.results.map((r) => r.title)).toEqual(['A Book', 'Z Book'])
        expect(results.pagination.total).toBe(2)
    })

    it('should handle search with combined options', async () => {
        const repositoryWithFilter = new MockMemoryRepository({
            schema: mockSchema,
            filter: (data, filters) => {
                if (filters.text) {
                    return data.title.toLowerCase().includes(filters.text.toLowerCase())
                }
                return true
            },
        })

        const serviceWithFilter = new ReadOnlyModelService({
            repository: repositoryWithFilter,
            emitter: new EventManager(),
            namespace,
            schema: mockSchema,
        })

        const controller = new ReadOnlyModelController(serviceWithFilter, authValidator)

        await repositoryWithFilter.create({ title: 'Test Z Book', author: 'Author 1', publishedDate: new Date() })
        await repositoryWithFilter.create({ title: 'Test A Book', author: 'Author 2', publishedDate: new Date() })
        await repositoryWithFilter.create({ title: 'Other Book', author: 'Author 3', publishedDate: new Date() })

        const results = await controller.search(
            { text: 'Test' },
            {
                sort: [{ title: 'asc' }],
                pagination: { page: 1, pageSize: 1 },
            },
        )

        expect(results.results).toHaveLength(1)
        expect(results.results[0].title).toBe('Test A Book')
        expect(results.pagination.total).toBe(2)
        expect(results.pagination.totalPages).toBe(2)
    })
})
