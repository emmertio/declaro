import { describe, expect, it } from 'bun:test'
import type { JSONSchema } from '../../schema/json-schema'
import { stripPrivateFieldsFromSchema, stripPrivateValues } from './schema-utils'

describe('stripPrivateValues', () => {
    it('should remove private fields at the top level', () => {
        const schema: JSONSchema = {
            type: 'object',
            properties: {
                id: { type: 'string' },
                secret: { type: 'string', private: true },
            },
        }

        const payload: Record<string, unknown> = { id: 'a', secret: 'shh' }

        expect(stripPrivateValues(payload, schema)).toEqual({ id: 'a' })
    })

    it('should remove private fields nested in objects', () => {
        const schema: JSONSchema = {
            type: 'object',
            properties: {
                owner: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        secret: { type: 'string', private: true },
                    },
                },
            },
        }

        const payload: Record<string, unknown> = { owner: { name: 'Ada', secret: 'shh' } }

        expect(stripPrivateValues(payload, schema)).toEqual({ owner: { name: 'Ada' } })
    })

    it('should remove private fields inside arrays', () => {
        const schema: JSONSchema = {
            type: 'object',
            properties: {
                watchers: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            name: { type: 'string' },
                            secret: { type: 'string', private: true },
                        },
                    },
                },
            },
        }

        const payload: Record<string, unknown> = { watchers: [{ name: 'Ada', secret: 'shh' }] }

        expect(stripPrivateValues(payload, schema)).toEqual({ watchers: [{ name: 'Ada' }] })
    })

    it('should follow $ref pointers into $defs', () => {
        const schema: JSONSchema = {
            type: 'object',
            properties: {
                owner: { $ref: '#/$defs/User' },
            },
            $defs: {
                User: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        secret: { type: 'string', private: true },
                    },
                },
            },
        }

        const payload: Record<string, unknown> = { owner: { name: 'Ada', secret: 'shh' } }

        expect(stripPrivateValues(payload, schema)).toEqual({ owner: { name: 'Ada' } })
    })

    it('should strip a field marked private in any union branch', () => {
        const schema: JSONSchema = {
            anyOf: [
                { type: 'object', properties: { value: { type: 'string' } } },
                { type: 'object', properties: { value: { type: 'string', private: true } } },
            ],
        }

        const payload: Record<string, unknown> = { value: 'shh' }

        expect(stripPrivateValues(payload, schema)).toEqual({})
    })

    it('should not modify the value it is given', () => {
        const schema: JSONSchema = {
            type: 'object',
            properties: {
                id: { type: 'string' },
                secret: { type: 'string', private: true },
            },
        }
        const original: Record<string, unknown> = { id: 'a', secret: 'shh' }

        stripPrivateValues(original, schema)

        expect(original.secret).toBe('shh')
    })

    it('should return the original value when there is nothing to strip', () => {
        const schema: JSONSchema = { type: 'object', properties: { id: { type: 'string' } } }
        const original: Record<string, unknown> = { id: 'a' }

        expect(stripPrivateValues(original, schema)).toBe(original)
    })

    it('should leave dates intact', () => {
        const schema: JSONSchema = {
            type: 'object',
            properties: {
                when: { type: 'string', format: 'date-time' },
                secret: { type: 'string', private: true },
            },
        }
        const when = new Date('2020-01-01T00:00:00.000Z')

        const payload: Record<string, unknown> = { when, secret: 'shh' }

        expect(stripPrivateValues(payload, schema)).toEqual({ when })
    })

    it('should survive a schema that references itself', () => {
        const schema: JSONSchema = {
            type: 'object',
            properties: {
                child: { $ref: '#' },
                secret: { type: 'string', private: true },
            },
        }

        const payload: Record<string, unknown> = { child: { secret: 'shh' }, secret: 'shh' }

        expect(stripPrivateValues(payload, schema)).toEqual({ child: {} })
    })

    it('should return the value unchanged when no schema is given', () => {
        const original: Record<string, unknown> = { secret: 'shh' }

        expect(stripPrivateValues(original, undefined)).toBe(original)
    })
})

describe('stripPrivateFieldsFromSchema', () => {
    it('should remove private properties nested in arrays and $defs', () => {
        const schema: JSONSchema = {
            type: 'object',
            properties: {
                watchers: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            name: { type: 'string' },
                            secret: { type: 'string', private: true },
                        },
                    },
                },
            },
            $defs: {
                User: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        secret: { type: 'string', private: true },
                    },
                },
            },
        }

        const stripped = stripPrivateFieldsFromSchema(schema)

        const items = (stripped.properties?.['watchers'] as JSONSchema).items as JSONSchema
        const definitions = stripped.$defs as Record<string, JSONSchema>

        expect(Object.keys(items.properties!)).toEqual(['name'])
        expect(Object.keys(definitions!['User']!.properties!)).toEqual(['name'])
    })
})
