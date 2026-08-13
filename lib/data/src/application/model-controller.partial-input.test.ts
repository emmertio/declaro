import { AuthValidator, getMockAuthSession, mockAuthConfig, MockAuthService } from '@declaro/auth'
import { EventManager, MockModel, ModelSchema, ValidationError } from '@declaro/core'
import { sortArray, ZodModel } from '@declaro/zod'
import { beforeEach, describe, expect, it } from 'bun:test'
import { z } from 'zod/v4'
import { ModelService, type INormalizeInputArgs } from '../domain/services/model-service'
import {
    buildMockUser,
    MockUserSchema,
    type MockUserInput,
} from '../test/mock/models/mock-user-models'
import { MockMemoryRepository } from '../test/mock/repositories/mock-memory-repository'
import { ModelController } from './model-controller'

/**
 * A complete, valid input for creating a user. Tests that need an invalid or partial payload
 * remove or replace fields from this.
 * @param overrides Values to change on the generated input.
 * @returns A writable user payload.
 */
function buildInput(overrides: Partial<MockUserInput> = {}): MockUserInput {
    return {
        name: 'Grace Hopper',
        email: 'grace@example.com',
        passwordHash: 'another-secret',
        ...overrides,
    } as MockUserInput
}

describe('ModelController partial input', () => {
    const namespace = 'users'
    const authService = new MockAuthService(mockAuthConfig)
    const claims = ['users::user.read:all', 'users::user.write:all']

    let repository: MockMemoryRepository<typeof MockUserSchema>
    let service: ModelService<typeof MockUserSchema>
    let controller: ModelController<typeof MockUserSchema>

    beforeEach(async () => {
        repository = new MockMemoryRepository({ schema: MockUserSchema })
        service = new ModelService({
            repository,
            emitter: new EventManager(),
            schema: MockUserSchema,
            namespace,
        })
        controller = new ModelController(
            service,
            new AuthValidator(getMockAuthSession({ claims }), null, authService),
        )

        await repository.create(buildMockUser() as any)
    })

    describe('create', () => {
        it('should require the whole input', async () => {
            await expect(controller.create({ email: 'grace@example.com' } as any)).rejects.toThrow(ValidationError)
        })

        it('should create a record from a whole valid input', async () => {
            const created = await controller.create(buildInput())

            expect(created.name).toBe('Grace Hopper')
        })
    })

    describe('update', () => {
        it('should accept a fragment carrying a single field', async () => {
            const updated = await controller.update({ id: 1 }, { email: 'abc@gmail.com' })

            expect(updated.email).toBe('abc@gmail.com')
        })

        it('should keep every field the fragment does not carry', async () => {
            const updated = await controller.update({ id: 1 }, { email: 'abc@gmail.com' })

            expect(updated.name).toBe('Ada Lovelace')
            expect(updated.passwordHash).toBe('hashed-secret')
            expect(updated.slug).toBe('ada-lovelace')
        })

        it('should accept an empty fragment, which changes nothing', async () => {
            const updated = await controller.update({ id: 1 }, {})

            expect(updated.name).toBe('Ada Lovelace')
            expect(updated.email).toBe('ada@example.com')
        })

        it('should reject a fragment whose value breaks a field rule', async () => {
            await expect(controller.update({ id: 1 }, { email: 'LKSJDFLSKJDF' })).rejects.toThrow(ValidationError)
        })

        it('should reject a fragment whose value has the wrong type', async () => {
            await expect(controller.update({ id: 1 }, { name: 42 as never })).rejects.toThrow(ValidationError)
        })

        it('should not let a fragment set a private input field', async () => {
            const updated = await controller.update({ id: 1 }, { slug: 'injected-slug' } as any)

            expect(updated.slug).toBe('ada-lovelace')
        })

        it('should leave the record untouched when the fragment is rejected', async () => {
            await controller.update({ id: 1 }, { email: 'LKSJDFLSKJDF' }).catch(() => undefined)

            const stored = await repository.load({ id: 1 })

            expect(stored?.email).toBe('ada@example.com')
        })
    })

    describe('upsert', () => {
        it('should accept a fragment addressing an existing record', async () => {
            const upserted = await controller.upsert({ id: 1, email: 'abc@gmail.com' })

            expect(upserted.email).toBe('abc@gmail.com')
            expect(upserted.name).toBe('Ada Lovelace')
        })

        it('should reject an invalid value on a fragment addressing an existing record', async () => {
            await expect(controller.upsert({ id: 1, email: 'LKSJDFLSKJDF' })).rejects.toThrow(ValidationError)
        })

        it('should require the whole input when there is no primary key', async () => {
            await expect(controller.upsert({ email: 'grace@example.com' })).rejects.toThrow(ValidationError)
        })

        it('should create a record from a whole input when there is no primary key', async () => {
            const upserted = await controller.upsert(buildInput())

            expect(upserted.name).toBe('Grace Hopper')
        })

        it('should require the whole input when the primary key matches nothing', async () => {
            await expect(controller.upsert({ id: 999, email: 'grace@example.com' })).rejects.toThrow(ValidationError)
        })

        it('should create a record from a whole input whose primary key matches nothing', async () => {
            const upserted = await controller.upsert(buildInput({ id: 2 }))

            expect(upserted.id).toBe(2)
            expect(upserted.name).toBe('Grace Hopper')
        })
    })

    describe('bulkUpsert', () => {
        it('should hold each payload to the rules of the operation it will perform', async () => {
            const upserted = await controller.bulkUpsert([
                { id: 1, email: 'abc@gmail.com' },
                buildInput({ id: 2 }),
            ])

            expect(upserted[0]?.email).toBe('abc@gmail.com')
            expect(upserted[0]?.name).toBe('Ada Lovelace')
            expect(upserted[1]?.name).toBe('Grace Hopper')
        })

        it('should reject the batch when a payload that will create a record is a fragment', async () => {
            await expect(
                controller.bulkUpsert([
                    { id: 1, email: 'abc@gmail.com' },
                    { id: 999, email: 'grace@example.com' },
                ]),
            ).rejects.toThrow(ValidationError)
        })

        it('should reject the batch when a fragment carries an invalid value', async () => {
            await expect(controller.bulkUpsert([{ id: 1, email: 'LKSJDFLSKJDF' }])).rejects.toThrow(ValidationError)
        })

        it('should accept an empty batch', async () => {
            expect(await controller.bulkUpsert([])).toEqual([])
        })
    })

    describe('normalize hooks', () => {
        /**
         * A service that derives `slug` from the name, as a real service owning a computed field
         * would. A fragment that does not carry a name must leave the slug alone.
         */
        class SluggingService extends ModelService<typeof MockUserSchema> {
            protected async normalizeInput(
                input: Partial<MockUserInput>,
                args: INormalizeInputArgs<typeof MockUserSchema>,
            ): Promise<Partial<MockUserInput>> {
                const normalized = await super.normalizeInput(input, args)

                if (normalized.name === undefined) {
                    return normalized
                }

                return {
                    ...normalized,
                    slug: normalized.name.toLowerCase().replace(/\s+/g, '-'),
                }
            }
        }

        let slugging: ModelController<typeof MockUserSchema>

        beforeEach(() => {
            slugging = new ModelController(
                new SluggingService({
                    repository,
                    emitter: new EventManager(),
                    schema: MockUserSchema,
                    namespace,
                }),
                new AuthValidator(getMockAuthSession({ claims }), null, authService),
            )
        })

        it('should hand the hook a fragment and keep the computed field when it is not affected', async () => {
            const updated = await slugging.update({ id: 1 }, { email: 'abc@gmail.com' })

            expect(updated.slug).toBe('ada-lovelace')
        })

        it('should recompute the field when the fragment carries what it derives from', async () => {
            const updated = await slugging.update({ id: 1 }, { name: 'Ada King' })

            expect(updated.slug).toBe('ada-king')
        })
    })

    describe('input models that cannot derive a partial', () => {
        /**
         * A schema whose input model is a plain `Model` subclass with no partial support, as a
         * custom model integration might be. Fragments must fall back to whole-payload
         * validation rather than skipping validation.
         */
        const RigidUserSchema = ModelSchema.create('RigidUser')
            .read({
                detail: (h) =>
                    new ZodModel(
                        h.name,
                        z.object({ id: z.number(), name: z.string(), email: z.string() }),
                    ),
                lookup: (h) => new ZodModel(h.name, z.object({ id: z.number() })),
            })
            .search({
                filters: (h) => new ZodModel(h.name, z.object({ text: z.string().optional() })),
                summary: (h) => new ZodModel(h.name, z.object({ id: z.number(), name: z.string() })),
                sort: (h) => new ZodModel(h.name, sortArray(['name'])),
            })
            .write({
                input: (h) =>
                    new MockModel(
                        h.name,
                        z.object({
                            id: z.number().optional(),
                            name: z.string().min(2),
                            email: z.email(),
                        }),
                    ),
            })
            .entity({ primaryKey: 'id' })

        let rigid: ModelController<typeof RigidUserSchema>

        beforeEach(async () => {
            const rigidRepository = new MockMemoryRepository({ schema: RigidUserSchema })
            rigid = new ModelController(
                new ModelService({
                    repository: rigidRepository,
                    emitter: new EventManager(),
                    schema: RigidUserSchema,
                    namespace,
                }),
                new AuthValidator(
                    getMockAuthSession({ claims: ['users::rigid-user.read:all', 'users::rigid-user.write:all'] }),
                    null,
                    authService,
                ),
            )

            await rigidRepository.create({ id: 1, name: 'Ada Lovelace', email: 'ada@example.com' } as any)
        })

        it('should fall back to whole-payload validation rather than skipping validation', async () => {
            await expect(rigid.update({ id: 1 }, { email: 'abc@gmail.com' })).rejects.toThrow(ValidationError)
        })

        it('should still accept a whole valid payload on update', async () => {
            const updated = await rigid.update({ id: 1 }, { name: 'Ada King', email: 'abc@gmail.com' })

            expect(updated.email).toBe('abc@gmail.com')
        })
    })

    describe('validation examples from the specification', () => {
        it('should accept { email } with a valid address', async () => {
            await expect(controller.update({ id: 1 }, { email: 'xyz@gmail.com' })).resolves.toBeDefined()
        })

        it('should accept { name } with a valid name', async () => {
            await expect(controller.update({ id: 1 }, { name: 'Jane Doe' })).resolves.toBeDefined()
        })

        it('should reject { email } with a malformed address', async () => {
            await expect(controller.update({ id: 1 }, { email: 'LKSJDFLSKJDF' })).rejects.toThrow(ValidationError)
        })

        it('should reject { name } with a number', async () => {
            await expect(controller.update({ id: 1 }, { name: 42 as never })).rejects.toThrow(ValidationError)
        })
    })
})
