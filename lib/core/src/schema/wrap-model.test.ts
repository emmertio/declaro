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

    it('should validate on serialization by default', () => {
        const wrapped = wrapModel(userModel, { id: 42, name: 'Ada' } as any)

        expect(() => JSON.stringify(wrapped)).toThrow()
    })

    it('should skip validation when asked to', () => {
        const wrapped = wrapModel(userModel, { id: 42, name: 'Ada' } as any, { validate: false })

        expect(JSON.parse(JSON.stringify(wrapped))).toEqual({ id: 42, name: 'Ada' })
    })

    it('should throw a clear error when the model requires asynchronous validation', () => {
        const asyncModel = new MockModel(
            'AsyncUser',
            z.object({ id: z.string() }).refine(async () => true),
        )
        const wrapped = wrapModel(asyncModel, { id: 'u1' })

        expect(() => JSON.stringify(wrapped)).toThrow(/asynchronous validation/)
    })

    it('should replace rather than nest when a wrapped value is wrapped again', () => {
        const once = wrapModel(userModel, buildUser())
        const twice = wrapModel(userModel, once, { includePrivateFields: true })

        expect(getWrapOptions(twice)?.includePrivateFields).toBe(true)
        expect(JSON.parse(JSON.stringify(twice)).passwordHash).toBe('hashed-secret')
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
