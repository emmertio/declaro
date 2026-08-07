import { describe, expect, it } from 'bun:test'
import { z } from 'zod/v4'
import { ValidationError } from '../errors/errors'
import { MockModel } from './test/mock-model'

const userModel = new MockModel(
    'User',
    z.object({
        id: z.string(),
        name: z.string(),
        passwordHash: z.string().optional().meta({ private: true }),
    }),
)

describe('Model.stripExcludedFields', () => {
    it('should remove private fields nested in objects and arrays', () => {
        const todoModel = new MockModel(
            'Todo',
            z.object({
                title: z.string(),
                owner: userModel.schema,
                watchers: z.array(userModel.schema),
            }),
        )

        const stripped = todoModel.stripExcludedFields({
            title: 'Ship it',
            owner: { id: 'u1', name: 'Ada', passwordHash: 'shh' },
            watchers: [{ id: 'u2', name: 'Grace', passwordHash: 'shh' }],
        })

        expect(stripped).toEqual({
            title: 'Ship it',
            owner: { id: 'u1', name: 'Ada' },
            watchers: [{ id: 'u2', name: 'Grace' }],
        })
    })

    it('should not modify the value it is given', () => {
        const original = { id: 'u1', name: 'Ada', passwordHash: 'shh' }

        userModel.stripExcludedFields(original)

        expect(original.passwordHash).toBe('shh')
    })

    it('should return the original value when there is nothing to strip', () => {
        const original = { id: 'u1', name: 'Ada' }

        expect(userModel.stripExcludedFields(original)).toBe(original)
    })

    it('should return null and undefined unchanged', () => {
        expect(userModel.stripExcludedFields(null as any)).toBeNull()
        expect(userModel.stripExcludedFields(undefined as any)).toBeUndefined()
    })
})

describe('Model.validate', () => {
    it('should strip private fields so a client cannot write to them', async () => {
        const result = await userModel.validate({ id: 'u1', name: 'Ada', passwordHash: 'injected' })

        expect((result as { value: Record<string, unknown> }).value.passwordHash).toBeUndefined()
    })

    it('should keep private fields when the caller opts in', async () => {
        const result = await userModel.validate(
            { id: 'u1', name: 'Ada', passwordHash: 'set-by-service' },
            { includePrivateFields: true },
        )

        expect((result as { value: Record<string, unknown> }).value.passwordHash).toBe('set-by-service')
    })

    it('should throw a validation error naming the field that failed', async () => {
        await expect(userModel.validate({ id: 42, name: 'Ada' } as any)).rejects.toThrow(ValidationError)
    })

    it('should return issues instead of throwing when strict is false', async () => {
        const result = await userModel.validate({ id: 42, name: 'Ada' } as any, { strict: false })

        expect(result.issues?.length).toBeGreaterThan(0)
    })
})

describe('Model.validateSync', () => {
    it('should validate without awaiting', () => {
        const result = userModel.validateSync({ id: 'u1', name: 'Ada' })

        expect((result as { value: Record<string, unknown> }).value).toEqual({ id: 'u1', name: 'Ada' })
    })

    it('should throw when the underlying schema validates asynchronously', () => {
        const asyncModel = new MockModel(
            'AsyncUser',
            z.object({ id: z.string() }).refine(async () => true),
        )

        expect(() => asyncModel.validateSync({ id: 'u1' })).toThrow(/asynchronous validation/)
    })

    it('should report the same issues as the asynchronous path', async () => {
        const sync = userModel.validateSync({ id: 42 } as any, { strict: false })
        const async = await userModel.validate({ id: 42 } as any, { strict: false })

        expect(sync.issues?.map((issue) => issue.message)).toEqual(async.issues?.map((issue) => issue.message))
    })
})

describe("Model['~standard']", () => {
    it('should return issues rather than throwing, as the specification requires', async () => {
        const result = await userModel['~standard'].validate({ id: 42, name: 'Ada' })

        expect(result.issues?.length).toBeGreaterThan(0)
    })

    it('should strip private fields from valid input', async () => {
        const result = await userModel['~standard'].validate({
            id: 'u1',
            name: 'Ada',
            passwordHash: 'injected',
        })

        expect((result as { value: Record<string, unknown> }).value).toEqual({ id: 'u1', name: 'Ada' })
    })
})
