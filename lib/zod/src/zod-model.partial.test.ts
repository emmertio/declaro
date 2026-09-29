import { ValidationError } from '@declaro/core'
import { describe, expect, it } from 'bun:test'
import { z } from 'zod/v4'
import { privateField } from './fields'
import { sortArray } from './sort'
import { ZodModel } from './zod-model'

const inputModel = new ZodModel(
    'UserInput',
    z.object({
        id: z.coerce.number().optional(),
        name: z.string().min(2),
        email: z.email(),
        slug: privateField(z.string()),
    }),
)

describe('ZodModel.partial', () => {
    it('should accept a fragment carrying a subset of the fields', async () => {
        const result = await inputModel.partial()!.validate({ email: 'ada@example.com' })

        expect((result as { value: unknown }).value).toEqual({ email: 'ada@example.com' })
    })

    it('should accept an empty fragment, which changes nothing', async () => {
        const result = await inputModel.partial()!.validate({})

        expect((result as { value: unknown }).value).toEqual({})
    })

    it('should reject a fragment whose value breaks a field rule', async () => {
        await expect(inputModel.partial()!.validate({ email: 'LKSJDFLSKJDF' })).rejects.toThrow(ValidationError)
    })

    it('should reject a fragment whose value has the wrong type', async () => {
        await expect(inputModel.partial()!.validate({ name: 42 as never })).rejects.toThrow(ValidationError)
    })

    it('should still coerce values, so a fragment arrives in canonical form', async () => {
        const result = await inputModel.partial()!.validate({ id: '7' as never })

        expect((result as { value: { id: number } }).value.id).toBe(7)
    })

    it('should keep private fields private, so a fragment cannot set one', async () => {
        const result = await inputModel.partial()!.validate({ name: 'Ada', slug: 'injected' })

        expect((result as { value: Record<string, unknown> }).value).toEqual({ name: 'Ada' })
    })

    it('should keep the model name, so labels and errors read the same', () => {
        expect(inputModel.partial()!.name).toBe('UserInput')
    })

    it('should reuse one partial companion across calls', () => {
        expect(inputModel.partial()).toBe(inputModel.partial()!)
    })

    it('should return undefined for a schema that is not an object', () => {
        const sortModel = new ZodModel('UserSort', sortArray(['name']))

        expect(sortModel.partial()).toBeUndefined()
    })

    it('should leave the full model as strict as it was', async () => {
        inputModel.partial()

        await expect(inputModel.validate({ email: 'ada@example.com' } as never)).rejects.toThrow(ValidationError)
    })
})
