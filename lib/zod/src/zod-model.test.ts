import { ZodModel } from './zod-model'
import { z } from 'zod/v4'
import { describe, it, expect } from 'bun:test'
import { ValidationError } from '@declaro/core'

describe('ZodModel', () => {
    it('should be an instance of Model', () => {
        const schema = z.object({ name: z.string(), age: z.number() })
        const model = new ZodModel('User', schema)

        expect(model).toBeInstanceOf(ZodModel)
    })

    it('should validate inputs correctly in strict mode', async () => {
        const schema = z.object({ name: z.string(), age: z.number().lte(30) })
        const model = new ZodModel('User', schema)

        const validInput = { name: 'Alice', age: 30 }
        const validResult = await model.validate(validInput, { strict: true })
        expect(validResult).toEqual({ value: validInput })

        const invalidInput = { name: 'Alice', age: 30.5 } // Invalid case: age is a float instead of an integer
        await expect(async () => model.validate(invalidInput, { strict: true })).toThrowError(ValidationError)

        let threw = false
        try {
            await model.validate(invalidInput, { strict: true })
        } catch (error) {
            threw = true
            const validationError = error as ValidationError

            expect(validationError.message).toBe(
                `Validation failed for field \"Age\": Too big: expected number to be <=30`,
            )
        }

        expect(threw).toBe(true)
    })

    it('should validate inputs correctly in strict mode with custom field labels', async () => {
        const schema = z.object({
            name: z.string(),
            age: z.number().lte(30).meta({
                title: 'Custom Age',
            }),
        })
        const model = new ZodModel('User', schema)

        const validInput = { name: 'Alice', age: 30 }
        const validResult = await model.validate(validInput, { strict: true })
        expect(validResult).toEqual({ value: validInput })

        const invalidInput = { name: 'Alice', age: 30.5 } // Invalid case: age is a float instead of an integer
        await expect(async () => model.validate(invalidInput, { strict: true })).toThrowError(ValidationError)

        let threw = false
        try {
            await model.validate(invalidInput, { strict: true })
        } catch (error) {
            threw = true
            const validationError = error as ValidationError

            expect(validationError.message).toBe(
                `Validation failed for field \"Custom Age\": Too big: expected number to be <=30`,
            )
        }

        expect(threw).toBe(true)
    })

    it('should validate inputs correctly in non-strict mode', async () => {
        const schema = z.object({ name: z.string(), age: z.number().lte(30) })
        const model = new ZodModel('User', schema)

        const validInput = { name: 'Alice', age: 30 }
        const validResult = await model.validate(validInput, { strict: false })
        expect(validResult).toEqual({ value: validInput })

        const invalidInput = { name: 'Alice', age: 30.5 } // Invalid case: age is a float instead of an integer
        const invalidResult = await model.validate(invalidInput, { strict: false })
        expect(invalidResult).toEqual({ issues: expect.any(Array) })
    })

    it('should output a valid JSON Schema payload', async () => {
        const schema = z.object({
            name: z.string(),
            age: z.number(),
        })
        const model = new ZodModel('User', schema)

        const jsonSchema = await model.toJSONSchema()
        expect(jsonSchema).toMatchObject({
            type: 'object',
            properties: {
                name: { type: 'string' },
                age: { type: 'number' },
            },
            required: ['name', 'age'],
        })
    })
})
