import { AuthValidator, getMockAuthSession, mockAuthConfig, MockAuthService } from '@declaro/auth'
import { EventManager, unwrapDeep, ValidationError } from '@declaro/core'
import { beforeEach, describe, expect, it } from 'bun:test'
import { ModelService, type INormalizeInputArgs } from '../domain/services/model-service'
import {
    buildMockUser,
    MockUserSchema,
    type MockUserDetail,
    type MockUserInput,
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
 * A service that owns the `slug` field, which is why the input model marks it private.
 * Clients cannot set it, and the service derives it on every write.
 */
class MockUserService extends ModelService<typeof MockUserSchema> {
    protected async normalizeInput(
        input: MockUserInput,
        args: INormalizeInputArgs<typeof MockUserSchema>,
    ): Promise<MockUserInput> {
        const normalized = await super.normalizeInput(input, args)

        return {
            ...normalized,
            slug: normalized.name.toLowerCase().replace(/\s+/g, '-'),
        }
    }
}

describe('ModelController private fields', () => {
    const namespace = 'users'
    const authService = new MockAuthService(mockAuthConfig)

    let repository: MockMemoryRepository<typeof MockUserSchema>
    let service: MockUserService
    let controller: ModelController<typeof MockUserSchema>

    beforeEach(async () => {
        repository = new MockMemoryRepository({ schema: MockUserSchema })
        service = new MockUserService({
            repository,
            emitter: new EventManager(),
            schema: MockUserSchema,
            namespace,
        })
        controller = new ModelController(
            service,
            new AuthValidator(
                getMockAuthSession({ claims: ['users::user.read:all', 'users::user.write:all'] }),
                null,
                authService,
            ),
        )

        await repository.create(buildMockUser() as any)
    })

    describe('responses', () => {
        it('should hide detail private fields from a load response', async () => {
            const response = asResponse(await controller.load({ id: 1 }))

            expect(response.passwordHash).toBeUndefined()
            expect(response.name).toBe('Ada Lovelace')
            expect(response.email).toBe('ada@example.com')
        })

        it('should hide detail private fields from a loadMany response', async () => {
            const response = asResponse(await controller.loadMany([{ id: 1 }]))

            expect(response[0].passwordHash).toBeUndefined()
            expect(response[0].name).toBe('Ada Lovelace')
        })

        it('should serialize search results with the summary model, not the detail model', async () => {
            const response = asResponse(await controller.search({}))

            // Email is private on the summary model but public on the detail model, so seeing it
            // here would mean the wrong model was used.
            expect(response.results[0].email).toBeUndefined()
            expect(response.results[0].name).toBe('Ada Lovelace')
            expect(response.pagination).toBeDefined()
        })

        it('should serialize remove responses with the summary model', async () => {
            const response = asResponse(await controller.remove({ id: 1 }))

            expect(response.email).toBeUndefined()
            expect(response.id).toBe(1)
        })

        it('should serialize restore responses with the summary model', async () => {
            await controller.remove({ id: 1 })

            const response = asResponse(await controller.restore({ id: 1 }))

            expect(response.email).toBeUndefined()
            expect(response.id).toBe(1)
        })

        it('should hide private fields from a create response', async () => {
            const response = asResponse(
                await controller.create({
                    name: 'Grace Hopper',
                    email: 'grace@example.com',
                    passwordHash: 'another-secret',
                } as any),
            )

            expect(response.passwordHash).toBeUndefined()
            expect(response.name).toBe('Grace Hopper')
        })

        it('should hide private fields from a custom controller method', async () => {
            class ReportingController extends ModelController<typeof MockUserSchema> {
                /** A hand written endpoint whose author never calls a serializer. */
                async loadWithLabel(id: number) {
                    return { user: await this.service.load({ id }), label: 'report' }
                }
            }

            const custom = new ReportingController(
                service,
                new AuthValidator(getMockAuthSession({ claims: ['users::user.read:all'] }), null, authService),
            )

            const response = asResponse(await custom.loadWithLabel(1))

            expect(response.user.passwordHash).toBeUndefined()
            expect(response.label).toBe('report')
        })

        it('should survive a normalizeDetail override that rebuilds the record', async () => {
            class SpreadingService extends ModelService<typeof MockUserSchema> {
                async normalizeDetail(detail: MockUserDetail): Promise<MockUserDetail> {
                    return { ...detail, name: detail.name.toUpperCase() }
                }
            }

            const spreadingService = new SpreadingService({
                repository,
                emitter: new EventManager(),
                schema: MockUserSchema,
                namespace,
            })
            const spreadingController = new ModelController(
                spreadingService,
                new AuthValidator(getMockAuthSession({ claims: ['users::user.read:all'] }), null, authService),
            )

            const response = asResponse(await spreadingController.load({ id: 1 }))

            expect(response.passwordHash).toBeUndefined()
            expect(response.name).toBe('ADA LOVELACE')
        })
    })

    describe('service layer access', () => {
        it('should still expose private fields to service layer callers', async () => {
            const detail = await service.load({ id: 1 })

            expect(detail.passwordHash).toBe('hashed-secret')
        })

        it('should still expose private fields on a controller response read directly', async () => {
            const detail = await controller.load({ id: 1 })

            expect(detail.passwordHash).toBe('hashed-secret')
        })

        it('should not remove private fields from the record held by the repository', async () => {
            asResponse(await controller.load({ id: 1 }))

            const stored = await repository.load({ id: 1 })

            expect(stored?.passwordHash).toBe('hashed-secret')
        })

        it('should keep private fields when a payload is unwrapped for storage', async () => {
            const detail = await controller.load({ id: 1 })

            expect(asResponse(unwrapDeep(detail)).passwordHash).toBe('hashed-secret')
        })
    })

    describe('input', () => {
        it('should strip private input fields so a client cannot set a computed value', async () => {
            const created = await controller.create({
                name: 'Grace Hopper',
                email: 'grace@example.com',
                passwordHash: 'another-secret',
                slug: 'injected-slug',
            } as any)

            // The client's value was discarded and the service derived its own.
            expect(created.slug).toBe('grace-hopper')
        })

        it('should strip private input fields on update', async () => {
            const updated = await controller.update({ id: 1 }, {
                name: 'Ada L',
                email: 'ada@example.com',
                passwordHash: 'hashed-secret',
                slug: 'injected-slug',
            } as any)

            expect(updated.slug).toBe('ada-l')
        })

        it('should strip private input fields on upsert', async () => {
            const upserted = await controller.upsert({
                id: 1,
                name: 'Ada L',
                email: 'ada@example.com',
                passwordHash: 'hashed-secret',
                slug: 'injected-slug',
            } as any)

            expect(upserted.slug).toBe('ada-l')
        })

        it('should strip private input fields on bulkUpsert', async () => {
            const upserted = await controller.bulkUpsert([
                {
                    id: 1,
                    name: 'Ada L',
                    email: 'ada@example.com',
                    passwordHash: 'hashed-secret',
                    slug: 'injected-slug',
                },
            ] as any)

            expect(upserted[0]?.slug).toBe('ada-l')
        })

        it('should reject input that does not satisfy the model', async () => {
            await expect(controller.create({ name: 'x' } as any)).rejects.toThrow(ValidationError)
        })

        it('should allow the service to set a private input field directly', async () => {
            const baseService = new ModelService({
                repository,
                emitter: new EventManager(),
                schema: MockUserSchema,
                namespace,
            })

            const created = await baseService.create({
                name: 'Grace Hopper',
                email: 'grace@example.com',
                passwordHash: 'another-secret',
                slug: 'set-by-service',
            } as any)

            expect(created.slug).toBe('set-by-service')
        })
    })
})
