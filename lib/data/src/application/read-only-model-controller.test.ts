import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { ReadOnlyModelController } from './read-only-model-controller'
import { ReadOnlyModelService } from '../domain/services/read-only-model-service'
import { MockMemoryRepository } from '../test/mock/repositories/mock-memory-repository'
import { MockBookSchema } from '../test/mock/models/mock-book-models'
import { AuthService, AuthValidator, getMockAuthSession, mockAuthConfig, MockAuthService } from '@declaro/auth'
import { EventManager, PermissionError, UnauthorizedError } from '@declaro/core'

describe('ReadOnlyModelController', () => {
    const namespace = 'books'
    const primaryKey = 'id'
    const mockSchema = MockBookSchema
    const authService = new MockAuthService(mockAuthConfig)

    let repository: MockMemoryRepository<typeof mockSchema>
    let service: ReadOnlyModelService<typeof mockSchema>
    let authValidator: AuthValidator
    let invalidAuthValidator: AuthValidator

    beforeEach(() => {
        repository = new MockMemoryRepository({ primaryKey, schema: mockSchema })
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

        const input = { id: '42', title: 'Test Book', author: 'Author Name', publishedDate: new Date() }
        await repository.create(input)

        const record = await controller.load({ id: '42' })

        expect(record).toEqual(input)
    })

    it('should throw PermissionError if permissions are invalid for load', async () => {
        const controller = new ReadOnlyModelController(service, invalidAuthValidator)

        await expect(controller.load({ id: '42' })).rejects.toThrow(PermissionError)
    })

    it('should load multiple records if permissions are valid', async () => {
        const controller = new ReadOnlyModelController(service, authValidator)

        const input1 = { id: '42', title: 'Test Book 1', author: 'Author Name 1', publishedDate: new Date() }
        const input2 = { id: '43', title: 'Test Book 2', author: 'Author Name 2', publishedDate: new Date() }
        await repository.create(input1)
        await repository.create(input2)

        const records = await controller.loadMany([{ id: '42' }, { id: '43' }])

        expect(records).toEqual([input1, input2])
    })

    it('should throw PermissionError if permissions are invalid for loadMany', async () => {
        const controller = new ReadOnlyModelController(service, invalidAuthValidator)

        await expect(controller.loadMany([{ id: '42' }, { id: '43' }])).rejects.toThrow(PermissionError)
    })

    it('should search for records if permissions are valid', async () => {
        const controller = new ReadOnlyModelController(service, authValidator)

        const input1 = { id: '42', title: 'Test Book 1', author: 'Author Name 1', publishedDate: new Date() }
        const input2 = { id: '43', title: 'Test Book 2', author: 'Author Name 2', publishedDate: new Date() }
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
})
