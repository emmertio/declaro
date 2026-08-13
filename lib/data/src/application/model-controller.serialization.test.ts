import { AuthValidator, getMockAuthSession, mockAuthConfig, MockAuthService } from '@declaro/auth'
import { EventManager, unwrapDeep, type WrapModelOptions } from '@declaro/core'
import { beforeEach, describe, expect, it } from 'bun:test'
import { ModelService } from '../domain/services/model-service'
import {
    buildMockUser,
    MockNormalizedUserSchema,
    MockUserSchema,
    type MockUserDetail,
} from '../test/mock/models/mock-user-models'
import { MockMemoryRepository } from '../test/mock/repositories/mock-memory-repository'
import { ModelController } from './model-controller'

/**
 * Serializes a payload the way a transport would, so tests assert on what a client actually
 * receives rather than on what the object holds in memory.
 * @param value The payload to serialize.
 * @returns The payload as it would be sent.
 */
function asResponse<T>(value: T): any {
    return JSON.parse(JSON.stringify(value))
}

/**
 * The columns a data store carries that no model declares: a tenant discriminator, a soft delete
 * marker, and an internal note. A repository that selects whole rows hands all three to the
 * service, and none of them belongs in a response.
 */
const storedExtras = {
    tenantId: 'tenant-42',
    deletedAt: null,
    internalNote: 'flagged by ops',
}

describe('ModelController serialization', () => {
    const namespace = 'users'
    const authService = new MockAuthService(mockAuthConfig)
    const claims = [
        'users::user.read:all',
        'users::user.write:all',
        'users::normalized-user.read:all',
        'users::normalized-user.write:all',
    ]

    let repository: MockMemoryRepository<typeof MockUserSchema>
    let service: ModelService<typeof MockUserSchema>
    let controller: ModelController<typeof MockUserSchema>

    /**
     * Builds a controller over the shared repository.
     * @param build Produces the service the controller sits on. Defaults to a plain service.
     * @returns The controller.
     */
    function buildController(
        build?: (args: any) => ModelService<typeof MockUserSchema>,
    ): ModelController<typeof MockUserSchema> {
        const args = { repository, emitter: new EventManager(), schema: MockUserSchema, namespace }
        const built = build ? build(args) : new ModelService(args)

        return new ModelController(
            built,
            new AuthValidator(getMockAuthSession({ claims }), null, authService),
        )
    }

    beforeEach(async () => {
        repository = new MockMemoryRepository({ schema: MockUserSchema })
        service = new ModelService({
            repository,
            emitter: new EventManager(),
            schema: MockUserSchema,
            namespace,
        })
        controller = buildController(() => service)

        await repository.create({ ...buildMockUser(), ...storedExtras } as any)
    })

    describe('fields the model does not declare', () => {
        it('should strip them from a load response', async () => {
            const response = asResponse(await controller.load({ id: 1 }))

            expect(response).toEqual({
                id: 1,
                name: 'Ada Lovelace',
                email: 'ada@example.com',
                slug: 'ada-lovelace',
            })
        })

        it('should strip them from a loadMany response', async () => {
            const response = asResponse(await controller.loadMany([{ id: 1 }]))

            expect(response[0].tenantId).toBeUndefined()
            expect(response[0].internalNote).toBeUndefined()
            expect(response[0].name).toBe('Ada Lovelace')
        })

        it('should strip them from search results, using the summary model', async () => {
            const response = asResponse(await controller.search({}))

            expect(response.results[0]).toEqual({ id: 1, name: 'Ada Lovelace' })
        })

        it('should strip them from a remove response', async () => {
            const response = asResponse(await controller.remove({ id: 1 }))

            expect(response.tenantId).toBeUndefined()
            expect(response.id).toBe(1)
        })

        it('should strip them from a create response', async () => {
            const created = await controller.create({
                name: 'Grace Hopper',
                email: 'grace@example.com',
                passwordHash: 'another-secret',
            } as any)

            expect(asResponse(created).passwordHash).toBeUndefined()
            expect(asResponse(created).tenantId).toBeUndefined()
        })

        it('should strip them when a normalize hook adds them on the way out', async () => {
            const custom = buildController(
                (args) =>
                    new (class extends ModelService<typeof MockUserSchema> {
                        async normalizeDetail(detail: MockUserDetail): Promise<MockUserDetail> {
                            return { ...detail, computedRank: 1 } as any
                        }
                    })(args),
            )

            const response = asResponse(await custom.load({ id: 1 }))

            expect(response.computedRank).toBeUndefined()
            expect(response.name).toBe('Ada Lovelace')
        })

        it('should strip them alongside the private fields', async () => {
            const response = asResponse(await controller.load({ id: 1 }))

            expect(response.passwordHash).toBeUndefined()
            expect(response.internalNote).toBeUndefined()
        })

        it('should still expose them to the service layer', async () => {
            const detail: any = await service.load({ id: 1 })

            expect(detail.internalNote).toBe('flagged by ops')
            expect(detail.passwordHash).toBe('hashed-secret')
        })

        it('should still expose them on a controller response read directly', async () => {
            const detail: any = await controller.load({ id: 1 })

            expect(detail.tenantId).toBe('tenant-42')
        })

        it('should keep them on a payload unwrapped for storage', async () => {
            const detail = await controller.load({ id: 1 })

            expect(asResponse(unwrapDeep(detail)).internalNote).toBe('flagged by ops')
        })

        it('should not remove them from the record held by the repository', async () => {
            asResponse(await controller.load({ id: 1 }))

            const stored: any = await repository.load({ id: 1 })

            expect(stored.internalNote).toBe('flagged by ops')
        })
    })

    describe('normalizers', () => {
        let normalizedRepository: MockMemoryRepository<typeof MockNormalizedUserSchema>
        let normalizedController: ModelController<typeof MockNormalizedUserSchema>

        beforeEach(async () => {
            normalizedRepository = new MockMemoryRepository({ schema: MockNormalizedUserSchema })
            normalizedController = new ModelController(
                new ModelService({
                    repository: normalizedRepository,
                    emitter: new EventManager(),
                    schema: MockNormalizedUserSchema,
                    namespace,
                }),
                new AuthValidator(getMockAuthSession({ claims }), null, authService),
            )

            await normalizedRepository.create({ id: 1, name: '  Ada Lovelace  ', ...storedExtras } as any)
        })

        it('should run a detail response through the model', async () => {
            const response = asResponse(await normalizedController.load({ id: 1 }))

            expect(response).toEqual({ id: 1, name: 'Ada Lovelace', role: 'member' })
        })

        it('should run a summary response through the model', async () => {
            const response = asResponse(await normalizedController.search({}))

            expect(response.results[0]).toEqual({ id: 1, name: 'Ada Lovelace' })
        })

        it('should leave the record the service holds unnormalized', async () => {
            const detail: any = await normalizedController.load({ id: 1 })

            expect(detail.name).toBe('  Ada Lovelace  ')
            expect(detail.role).toBeUndefined()
        })

        it('should send a record the model rejects as it stands, minus what it may not carry', async () => {
            // `name` is a number, which no coercion on this model accepts.
            await normalizedRepository.create({ id: 2, name: 7, ...storedExtras } as any)

            const response = asResponse(await normalizedController.load({ id: 2 }))

            expect(response).toEqual({ id: 2, name: 7 })
        })
    })

    describe('validation', () => {
        it('should not enforce the model constraints on a response by default', async () => {
            // `name` is too short for the detail model, which a service could produce from data
            // that predates the constraint. Trimming the response beats failing the request.
            await repository.create({ ...buildMockUser({ id: 2, name: 'A' }), ...storedExtras } as any)

            const response = asResponse(await controller.load({ id: 2 }))

            expect(response.name).toBe('A')
            expect(response.tenantId).toBeUndefined()
            expect(response.passwordHash).toBeUndefined()
        })

        it('should validate a response when a controller opts in', async () => {
            await repository.create({ ...buildMockUser({ id: 2, name: 'A' }), ...storedExtras } as any)

            class ValidatingController extends ModelController<typeof MockUserSchema> {
                protected override get wrapOptions(): WrapModelOptions {
                    return { validate: true }
                }
            }

            const validating = new ValidatingController(
                service,
                new AuthValidator(getMockAuthSession({ claims }), null, authService),
            )

            const detail = await validating.load({ id: 2 })

            expect(() => JSON.stringify(detail)).toThrow(/Name/)
        })

        it('should validate a response when a service opts in', async () => {
            class ValidatingService extends ModelService<typeof MockUserSchema> {
                protected override get wrapOptions(): WrapModelOptions {
                    return { validate: true }
                }
            }

            const validating = new ValidatingService({
                repository,
                emitter: new EventManager(),
                schema: MockUserSchema,
                namespace,
            })

            await repository.create({ ...buildMockUser({ id: 2, name: 'A' }), ...storedExtras } as any)

            const detail = await validating.load({ id: 2 })

            expect(() => JSON.stringify(detail)).toThrow(/Name/)
        })
    })
})
