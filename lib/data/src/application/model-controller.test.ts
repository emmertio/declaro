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
})
