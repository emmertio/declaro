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

    it('should support custom JSON Schema options', async () => {
        const schema = z.object({
            name: z.string(),
            age: z.number(),
            bdate: z.date(),
        })
        const model = new ZodModel('User', schema)

        const jsonSchema = await model.toJSONSchema({
            zodOptions: {
                unrepresentable: 'any',
                override: (ctx) => {
                    const def = ctx.zodSchema._zod.def
                    if (def.type === 'date') {
                        ctx.jsonSchema.type = 'number'
                        ctx.jsonSchema.format = 'date-time'
                    }
                },
            },
        })

        expect(jsonSchema).toMatchObject({
            type: 'object',
            properties: {
                name: { type: 'string' },
                age: { type: 'number' },
                bdate: { type: 'number', format: 'date-time' },
            },
            required: ['name', 'age', 'bdate'],
            $schema: 'https://json-schema.org/draft/2020-12/schema',
        })
    })

    it('should switch dates to strings in JSON Schema by default', async () => {
        const schema = z.object({
            name: z.string(),
            age: z.number(),
            bdate: z.date(),
        })
        const model = new ZodModel('User', schema)

        const jsonSchema = await model.toJSONSchema()
        expect(jsonSchema).toMatchObject({
            type: 'object',
            properties: {
                name: { type: 'string' },
                age: { type: 'number' },
                bdate: { type: 'string', format: 'date-time' },
            },
            required: ['name', 'age', 'bdate'],
            $schema: 'https://json-schema.org/draft/2020-12/schema',
        })
    })

    it('should switch bigint to string in JSON Schema by default', async () => {
        const schema = z.object({
            name: z.string(),
            age: z.number(),
            bigNumber: z.bigint(),
        })
        const model = new ZodModel('User', schema)

        const jsonSchema = await model.toJSONSchema()
        expect(jsonSchema).toMatchObject({
            type: 'object',
            properties: {
                name: { type: 'string' },
                age: { type: 'number' },
                bigNumber: { type: 'string', format: 'bigint' },
            },
            required: ['name', 'age', 'bigNumber'],
            $schema: 'https://json-schema.org/draft/2020-12/schema',
        })
    })

    it('should not include private fields in JSON Schema by default', async () => {
        const schema = z.object({
            id: z.string(),
            name: z.string(),
            secret: z.string().optional().meta({ private: true }),
            internalNote: z.string().optional().meta({ hidden: true }),
        })
        const model = new ZodModel('User', schema)

        const jsonSchema = await model.toJSONSchema()
        expect(jsonSchema).toMatchObject({
            type: 'object',
            properties: {
                id: { type: 'string' },
                name: { type: 'string' },
            },
            required: ['id', 'name'],
        })
    })

    it('should include private fields in JSON Schema when specified', async () => {
        const schema = z.object({
            id: z.string(),
            name: z.string(),
            secret: z.string().optional().meta({ private: true }),
            internalNote: z.string().optional().meta({ hidden: true }),
        })
        const model = new ZodModel('User', schema)

        const jsonSchema = await model.toJSONSchema({ includePrivateFields: true })
        expect(jsonSchema).toMatchObject({
            type: 'object',
            properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                secret: { type: 'string' },
                internalNote: { type: 'string' },
            },
            required: ['id', 'name'],
        })
    })
})
