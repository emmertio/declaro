import { describe, expect, it } from 'bun:test'
import { z } from 'zod'
import { createZodSchema } from '../schema/createZodSchema'

// Sample domain class
class Nested {
    constructor(public nestedField: string) {}
}

class User {
    constructor(
        public id: string,
        public name: string,
        public email: string,
        public createdAt: Date,
        public status: 'active' | 'inactive' | 'banned' | undefined,
        public nested?: Nested,
        public tags?: string[],
    ) {}
}

describe('createZodSchema', () => {
    const validUUID = '123e4567-e89b-12d3-a456-426614174000'

    it('should create a Zod schema with the correct fields', () => {
        const UserSchema = createZodSchema({
            class: User,
            fields: {
                id: z.string().uuid(),
                name: z.string().min(1),
                email: z.string().email(),
                createdAt: z.date(),
                status: z.enum(['active', 'inactive', 'banned']),
            },
        })

        const parsed = UserSchema.parse({
            id: validUUID,
            name: 'Jane Doe',
            email: 'jane@example.com',
            createdAt: new Date('2023-01-01T00:00:00Z'),
            status: 'active',
        })

        expect(parsed).toEqual({
            id: validUUID,
            name: 'Jane Doe',
            email: 'jane@example.com',
            createdAt: new Date('2023-01-01T00:00:00Z'),
            status: 'active',
        })
    })

    it('should throw an error for invalid data', () => {
        const UserSchema = createZodSchema({
            class: User,
            fields: {
                id: z.string().uuid(),
                name: z.string().min(1),
                email: z.string().email(),
                createdAt: z.date(),
                status: z.enum(['active', 'inactive', 'banned']),
            },
        })

        expect(() =>
            UserSchema.parse({
                id: 'invalid-uuid',
                name: '',
                email: 'not-an-email',
                createdAt: 'not-a-date',
                status: 'unknown',
            }),
        ).toThrow()
    })

    it('should include OpenAPI metadata if provided', () => {
        const UserSchema = createZodSchema({
            class: User,
            name: 'User',
            fields: {
                id: z.string().uuid().openapi({ example: validUUID }),
                name: z.string().min(1).openapi({ example: 'Jane Doe' }),
                email: z.string().email().openapi({ example: 'jane@example.com' }),
                createdAt: z.date().openapi({ example: '2023-01-01T00:00:00Z' }),
                status: z.enum(['active', 'inactive', 'banned']).openapi({ example: 'active' }),
            },
        })

        expect(UserSchema._def.zodOpenApi?.openapi?.title).toBe('User')
    })

    it('should handle optional fields correctly', () => {
        const UserSchema = createZodSchema({
            class: User,
            fields: {
                id: z.string().uuid(),
                name: z.string(),
                email: z.string().email(),
                createdAt: z.date(),
                status: z.enum(['active', 'inactive', 'banned']),
            },
        })

        const parsed = UserSchema.parse({
            id: validUUID,
            name: 'Jane Doe',
            email: 'jane@example.com',
            createdAt: new Date('2023-01-01T00:00:00Z'),
            status: 'active',
        })

        expect(parsed).toEqual({
            id: validUUID,
            name: 'Jane Doe',
            email: 'jane@example.com',
            createdAt: new Date('2023-01-01T00:00:00Z'),
            status: 'active',
        })
    })
})

describe('createZodSchema - Additional Tests', () => {
    it('should validate nested objects', () => {
        const UserSchema = createZodSchema({
            class: User,
            fields: {
                id: z.string().uuid(),
                name: z.string().min(1),
                email: z.string().email(),
                createdAt: z.date(),
                status: z.enum(['active', 'inactive', 'banned']),
                nested: z.object({ nestedField: z.string() }).optional(),
            },
        })

        const parsed = UserSchema.parse({
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Jane Doe',
            email: 'jane@example.com',
            createdAt: new Date('2023-01-01T00:00:00Z'),
            status: 'active',
            nested: { nestedField: 'nestedValue' },
        })

        expect(parsed.nested).toEqual({ nestedField: 'nestedValue' })
    })

    it('should validate arrays', () => {
        const UserSchema = createZodSchema({
            class: User,
            fields: {
                id: z.string().uuid(),
                name: z.string().min(1),
                email: z.string().email(),
                createdAt: z.date(),
                status: z.enum(['active', 'inactive', 'banned']),
                tags: z.array(z.string()).optional(),
            },
        })

        const parsed = UserSchema.parse({
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Jane Doe',
            email: 'jane@example.com',
            createdAt: new Date('2023-01-01T00:00:00Z'),
            status: 'active',
            tags: ['tag1', 'tag2'],
        })

        expect(parsed.tags).toEqual(['tag1', 'tag2'])
    })

    it('should validate optional enums', () => {
        const UserSchema = createZodSchema({
            class: User,
            fields: {
                id: z.string().uuid(),
                name: z.string().min(1),
                email: z.string().email(),
                createdAt: z.date(),
                status: z.enum(['active', 'inactive', 'banned']).optional(),
            },
        })

        const parsed = UserSchema.parse({
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Jane Doe',
            email: 'jane@example.com',
            createdAt: new Date('2023-01-01T00:00:00Z'),
        })

        expect(parsed.status).toBeUndefined()
    })

    it('should validate default values', () => {
        const UserSchema = createZodSchema({
            class: User,
            fields: {
                id: z.string().uuid(),
                name: z.string().min(1).default('Default Name'),
                email: z.string().email(),
                createdAt: z.date(),
                status: z.enum(['active', 'inactive', 'banned']),
            },
        })

        const parsed = UserSchema.parse({
            id: '123e4567-e89b-12d3-a456-426614174000',
            email: 'jane@example.com',
            createdAt: new Date('2023-01-01T00:00:00Z'),
            status: 'active',
        })

        expect(parsed.name).toBe('Default Name')
    })
})
