import { describe, expect, it } from 'bun:test'
import { z } from 'zod/v4'
import { MockModel } from './test/mock-model'
import {
    getWrapOptions,
    getWrappedModel,
    isWrapped,
    rewrapDeep,
    unwrapDeep,
    unwrapModel,
    wrapModel,
} from './wrap-model'

const userModel = new MockModel(
    'User',
    z.object({
        id: z.string(),
        name: z.string(),
        passwordHash: z.string().optional().meta({ private: true }),
    }),
)

const buildUser = () => ({ id: 'u1', name: 'Ada', passwordHash: 'hashed-secret' })

/**
 * A model whose schema normalizes as well as constrains: it trims, fills in a default, and
 * coerces.
 */
const normalizingModel = new MockModel(
    'Normalized',
    z.object({
        name: z.string().transform((value) => value.trim()),
        role: z.string().default('member'),
        id: z.coerce.string(),
    }),
)

/**
 * Builds a model whose schema can only be validated asynchronously.
 * @returns The model.
 */
const buildAsyncModel = () =>
    new MockModel(
        'AsyncUser',
        z.object({ id: z.string() }).refine(async () => true),
    )

describe('wrapModel', () => {
    it('should strip private fields when serialized', () => {
        const wrapped = wrapModel(userModel, buildUser())

        expect(JSON.parse(JSON.stringify(wrapped))).toEqual({ id: 'u1', name: 'Ada' })
    })

    it('should include private fields when asked to', () => {
        const wrapped = wrapModel(userModel, buildUser(), { includePrivateFields: true })

        expect(JSON.parse(JSON.stringify(wrapped))).toEqual({
            id: 'u1',
            name: 'Ada',
            passwordHash: 'hashed-secret',
        })
    })

    it('should still expose private fields when properties are read directly', () => {
        const wrapped = wrapModel(userModel, buildUser())

        expect(wrapped.passwordHash).toBe('hashed-secret')
        expect(Object.keys(wrapped).sort()).toEqual(['id', 'name', 'passwordHash'])
    })

    it('should behave like a plain object for equality comparisons', () => {
        const wrapped = wrapModel(userModel, buildUser())

        expect(wrapped).toEqual(buildUser())
        expect(wrapped).toStrictEqual(buildUser())
    })

    it('should not modify the original object', () => {
        const original = buildUser()

        wrapModel(userModel, original)

        expect(original.passwordHash).toBe('hashed-secret')
        expect(isWrapped(original)).toBe(false)
    })

    it('should not enforce the model constraints by default', () => {
        const wrapped = wrapModel(userModel, { id: 42, name: 'Ada' } as any)

        expect(JSON.parse(JSON.stringify(wrapped))).toEqual({ id: 42, name: 'Ada' })
    })

    it('should enforce the model constraints when asked to', () => {
        const wrapped = wrapModel(userModel, { id: 42, name: 'Ada' } as any, { validate: true })

        expect(() => JSON.stringify(wrapped)).toThrow()
    })

    it('should apply the model normalizers by default', () => {
        const wrapped = wrapModel(normalizingModel, { name: '  Ada  ', id: 42 } as any)

        expect(JSON.parse(JSON.stringify(wrapped))).toEqual({ name: 'Ada', role: 'member', id: '42' })
    })

    it('should apply the model normalizers when validating', () => {
        const wrapped = wrapModel(normalizingModel, { name: '  Ada  ', id: 42 } as any, { validate: true })

        expect(JSON.parse(JSON.stringify(wrapped))).toEqual({ name: 'Ada', role: 'member', id: '42' })
    })

    it('should apply the model normalizers to a trusted consumer payload', () => {
        const wrapped = wrapModel(normalizingModel, { name: '  Ada  ', id: 42 } as any, {
            includePrivateFields: true,
        })

        expect(JSON.parse(JSON.stringify(wrapped))).toEqual({ name: 'Ada', role: 'member', id: '42' })
    })

    it('should leave a payload the model rejects unnormalized rather than failing', () => {
        // `name` is missing, so the model cannot produce a normalized payload for this record.
        const wrapped = wrapModel(normalizingModel, { id: 42, injected: 'junk' } as any)

        expect(JSON.parse(JSON.stringify(wrapped))).toEqual({ id: 42 })
    })

    it('should serialize a model that validates asynchronously', () => {
        const wrapped = wrapModel(buildAsyncModel(), { id: 'u1', injected: 'junk' } as any)

        expect(JSON.parse(JSON.stringify(wrapped))).toEqual({ id: 'u1' })
    })

    it('should throw a clear error when a validating wrapper needs asynchronous validation', () => {
        const wrapped = wrapModel(buildAsyncModel(), { id: 'u1' }, { validate: true })

        expect(() => JSON.stringify(wrapped)).toThrow(/asynchronous validation/)
    })

    it('should strip fields the model does not declare', () => {
        const wrapped = wrapModel(userModel, { ...buildUser(), injected: 'junk' } as any)

        expect(JSON.parse(JSON.stringify(wrapped))).toEqual({ id: 'u1', name: 'Ada' })
    })

    it('should strip fields the model does not declare when validating', () => {
        const wrapped = wrapModel(userModel, { ...buildUser(), injected: 'junk' } as any, { validate: true })

        expect(JSON.parse(JSON.stringify(wrapped))).toEqual({ id: 'u1', name: 'Ada' })
    })

    it('should strip fields the model does not declare even for a trusted consumer', () => {
        const wrapped = wrapModel(userModel, { ...buildUser(), injected: 'junk' } as any, {
            includePrivateFields: true,
        })

        expect(JSON.parse(JSON.stringify(wrapped))).toEqual({
            id: 'u1',
            name: 'Ada',
            passwordHash: 'hashed-secret',
        })
    })

    it('should strip fields the model does not declare from nested objects and arrays', () => {
        const teamModel = new MockModel(
            'Team',
            z.object({
                owner: z.object({ name: z.string() }),
                members: z.array(z.object({ name: z.string() })),
            }),
        )

        const wrapped = wrapModel(teamModel, {
            owner: { name: 'Ada', injected: 'junk' },
            members: [{ name: 'Grace', injected: 'junk' }],
        } as any)

        expect(JSON.parse(JSON.stringify(wrapped))).toEqual({
            owner: { name: 'Ada' },
            members: [{ name: 'Grace' }],
        })
    })

    it('should still expose fields the model does not declare when properties are read directly', () => {
        const wrapped = wrapModel(userModel, { ...buildUser(), injected: 'junk' } as any)

        expect((wrapped as any).injected).toBe('junk')
    })

    it('should keep fields the model allows without declaring', () => {
        const looseModel = new MockModel('Loose', z.looseObject({ id: z.string() }))

        const wrapped = wrapModel(looseModel, { id: 'u1', extra: 'kept' } as any)

        expect(JSON.parse(JSON.stringify(wrapped))).toEqual({ id: 'u1', extra: 'kept' })
    })

    it('should replace rather than nest when a wrapped value is wrapped again', () => {
        const once = wrapModel(userModel, buildUser())
        const twice = wrapModel(userModel, once, { includePrivateFields: true })

        expect(getWrapOptions(twice)?.includePrivateFields).toBe(true)
        expect(JSON.parse(JSON.stringify(twice)).passwordHash).toBe('hashed-secret')
    })

    it('should default to stripping without validating', () => {
        expect(getWrapOptions(wrapModel(userModel, buildUser()))).toEqual({
            validate: false,
            includePrivateFields: false,
        })
    })

    it('should keep a separate prototype for each set of options', () => {
        const stripping = wrapModel(userModel, buildUser())
        const validating = wrapModel(userModel, buildUser(), { validate: true })

        expect(Object.getPrototypeOf(stripping)).not.toBe(Object.getPrototypeOf(validating))
        expect(getWrapOptions(validating)?.validate).toBe(true)
    })

    it('should expose the model it was wrapped with', () => {
        const wrapped = wrapModel(userModel, buildUser())

        expect(isWrapped(wrapped)).toBe(true)
        expect(getWrappedModel(wrapped)).toBe(userModel)
        expect((wrapped as any).getModelName()).toBe('User')
        expect(Object.keys((wrapped as any).introspect().properties)).not.toContain('passwordHash')
    })

    it('should return non-objects unchanged', () => {
        expect(wrapModel(userModel, null as any)).toBeNull()
        expect(wrapModel(userModel, 'text' as any)).toBe('text')
    })

    it('should reuse one prototype for the same model and options', () => {
        const first = wrapModel(userModel, buildUser())
        const second = wrapModel(userModel, buildUser())

        expect(Object.getPrototypeOf(first)).toBe(Object.getPrototypeOf(second))
    })
})

describe('unwrapModel', () => {
    it('should return the plain object', () => {
        const unwrapped = unwrapModel(wrapModel(userModel, buildUser()))

        expect(isWrapped(unwrapped)).toBe(false)
        expect(JSON.parse(JSON.stringify(unwrapped))).toEqual(buildUser())
    })

    it('should return values that were never wrapped unchanged', () => {
        const plain = buildUser()

        expect(unwrapModel(plain)).toBe(plain)
    })
})

describe('unwrapDeep', () => {
    it('should unwrap values nested in objects and arrays', () => {
        const payload = {
            owner: wrapModel(userModel, buildUser()),
            watchers: [wrapModel(userModel, buildUser())],
            count: 2,
        }

        const unwrapped = unwrapDeep(payload)

        expect(JSON.parse(JSON.stringify(unwrapped))).toEqual({
            owner: buildUser(),
            watchers: [buildUser()],
            count: 2,
        })
    })

    it('should return a payload with nothing wrapped unchanged', () => {
        const payload = { owner: buildUser() }

        expect(unwrapDeep(payload)).toBe(payload)
    })

    it('should leave dates intact', () => {
        const when = new Date('2020-01-01T00:00:00.000Z')

        expect(unwrapDeep({ when }).when).toBe(when)
    })
})

describe('rewrapDeep', () => {
    it('should keep each value model while changing its options', () => {
        const payload = { owner: wrapModel(userModel, buildUser()) }

        const rewrapped = rewrapDeep(payload, { includePrivateFields: true, validate: false })

        expect(getWrappedModel(rewrapped.owner)).toBe(userModel)
        expect(JSON.parse(JSON.stringify(rewrapped)).owner.passwordHash).toBe('hashed-secret')
    })

    it('should leave values that were never wrapped alone', () => {
        const payload = { plain: buildUser() }

        const rewrapped = rewrapDeep(payload, { includePrivateFields: true })

        expect(isWrapped(rewrapped.plain)).toBe(false)
    })
})
