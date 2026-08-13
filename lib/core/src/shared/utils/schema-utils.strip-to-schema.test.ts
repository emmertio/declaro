import { describe, expect, it } from 'bun:test'
import type { JSONSchema } from '../../schema/json-schema'
import { stripPrivateValues, stripToSchema } from './schema-utils'

/**
 * A payload as it arrives from a data store, before anything decides which of its keys are fields.
 */
type Payload = Record<string, unknown>

/**
 * A closed object schema, the shape a strip parser such as Zod emits.
 */
const closedSchema: JSONSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        secret: { type: 'string', private: true },
    },
    additionalProperties: false,
}

describe('stripToSchema', () => {
    describe('fields the schema does not describe', () => {
        it('should remove a field the schema does not name', () => {
            const payload: Payload = { id: 'a', injected: 'junk' }

            expect(stripToSchema(payload, closedSchema)).toEqual({ id: 'a' })
        })

        it('should remove a field when the schema names its properties but omits additionalProperties', () => {
            const schema: JSONSchema = { type: 'object', properties: { id: { type: 'string' } } }
            const payload: Payload = { id: 'a', injected: 'junk' }

            expect(stripToSchema(payload, schema)).toEqual({ id: 'a' })
        })

        it('should remove every field when the schema closes an object that names nothing', () => {
            const schema: JSONSchema = { type: 'object', additionalProperties: false }
            const payload: Payload = { injected: 'junk' }

            expect(stripToSchema(payload, schema)).toEqual({})
        })

        it('should remove a field nested in an object', () => {
            const schema: JSONSchema = {
                type: 'object',
                properties: {
                    owner: { type: 'object', properties: { name: { type: 'string' } } },
                },
            }
            const payload: Payload = { owner: { name: 'Ada', injected: 'junk' } }

            expect(stripToSchema(payload, schema)).toEqual({ owner: { name: 'Ada' } })
        })

        it('should remove a field from every item of an array', () => {
            const schema: JSONSchema = {
                type: 'object',
                properties: {
                    watchers: {
                        type: 'array',
                        items: { type: 'object', properties: { name: { type: 'string' } } },
                    },
                },
            }
            const payload: Payload = { watchers: [{ name: 'Ada', injected: 'junk' }, { name: 'Grace' }] }

            expect(stripToSchema(payload, schema)).toEqual({ watchers: [{ name: 'Ada' }, { name: 'Grace' }] })
        })

        it('should follow $ref pointers before deciding what a field is', () => {
            const schema: JSONSchema = {
                type: 'object',
                properties: { owner: { $ref: '#/$defs/User' } },
                additionalProperties: false,
                $defs: {
                    User: {
                        type: 'object',
                        properties: { name: { type: 'string' } },
                        additionalProperties: false,
                    },
                },
            }
            const payload: Payload = { owner: { name: 'Ada', injected: 'junk' } }

            expect(stripToSchema(payload, schema)).toEqual({ owner: { name: 'Ada' } })
        })

        it('should survive a schema that references itself', () => {
            const schema: JSONSchema = {
                type: 'object',
                properties: { child: { $ref: '#' }, id: { type: 'string' } },
                additionalProperties: false,
            }
            const payload: Payload = { child: { id: 'b', injected: 'junk' }, id: 'a' }

            expect(stripToSchema(payload, schema)).toEqual({ child: { id: 'b' }, id: 'a' })
        })

        it('should stop rather than recurse forever down a payload that references itself', () => {
            const schema: JSONSchema = {
                type: 'object',
                properties: { child: { $ref: '#' }, id: { type: 'string' } },
                additionalProperties: false,
            }

            const payload: Payload = { id: 'a', injected: 'junk' }
            let leaf = payload
            for (let depth = 0; depth < 150; depth++) {
                const child: Payload = { id: 'a', injected: 'junk' }
                leaf['child'] = child
                leaf = child
            }

            const stripped = stripToSchema(payload, schema) as Payload

            expect(stripped['injected']).toBeUndefined()
            expect((stripped['child'] as Payload)['injected']).toBeUndefined()
        })

        it('should resolve $ref pointers against an explicit root', () => {
            const root: JSONSchema = {
                $defs: {
                    User: {
                        type: 'object',
                        properties: { name: { type: 'string' } },
                        additionalProperties: false,
                    },
                },
            }
            const payload: Payload = { name: 'Ada', injected: 'junk' }

            expect(stripToSchema(payload, { $ref: '#/$defs/User' }, { root })).toEqual({ name: 'Ada' })
        })
    })

    describe('arrays', () => {
        it('should leave an array alone when the schema does not describe its items', () => {
            const schema: JSONSchema = {
                type: 'object',
                properties: { tags: { type: 'array' } },
                additionalProperties: false,
            }
            const tags = [{ label: 'urgent', injected: 'junk' }]

            expect(stripToSchema({ tags } as Payload, schema).tags).toBe(tags)
        })

        it('should leave a tuple alone, since its positions have no single shape', () => {
            const schema: JSONSchema = {
                type: 'object',
                properties: {
                    pair: { type: 'array', items: [{ type: 'string' }, { type: 'object' }] },
                },
                additionalProperties: false,
            }
            const pair = ['a', { injected: 'junk' }]

            expect(stripToSchema({ pair } as Payload, schema).pair).toBe(pair)
        })

        it('should return the original array when no item loses a field', () => {
            const schema: JSONSchema = {
                type: 'object',
                properties: {
                    watchers: {
                        type: 'array',
                        items: { type: 'object', properties: { name: { type: 'string' } } },
                    },
                },
                additionalProperties: false,
            }
            const watchers = [{ name: 'Ada' }]

            expect(stripToSchema({ watchers } as Payload, schema).watchers).toBe(watchers)
        })
    })

    describe('unions', () => {
        it('should keep a field named in any branch', () => {
            const schema: JSONSchema = {
                anyOf: [
                    { type: 'object', properties: { circle: { type: 'number' } }, additionalProperties: false },
                    { type: 'object', properties: { square: { type: 'number' } }, additionalProperties: false },
                ],
            }
            const payload: Payload = { square: 2, injected: 'junk' }

            expect(stripToSchema(payload, schema)).toEqual({ square: 2 })
        })

        it('should keep everything when any branch allows fields it does not name', () => {
            const schema: JSONSchema = {
                anyOf: [
                    { type: 'object', properties: { circle: { type: 'number' } }, additionalProperties: false },
                    { type: 'object', properties: { square: { type: 'number' } }, additionalProperties: true },
                ],
            }
            const payload: Payload = { square: 2, extra: 'kept' }

            expect(stripToSchema(payload, schema)).toEqual({ square: 2, extra: 'kept' })
        })

        it('should still remove a field marked private in any branch', () => {
            const schema: JSONSchema = {
                anyOf: [
                    { type: 'object', properties: { value: { type: 'string' } } },
                    { type: 'object', properties: { value: { type: 'string', private: true } } },
                ],
            }
            const payload: Payload = { value: 'shh' }

            expect(stripToSchema(payload, schema)).toEqual({})
        })

        it('should merge the fields of an allOf', () => {
            const schema: JSONSchema = {
                allOf: [
                    { type: 'object', properties: { id: { type: 'string' } }, additionalProperties: false },
                    { type: 'object', properties: { name: { type: 'string' } }, additionalProperties: false },
                ],
            }
            const payload: Payload = { id: 'a', name: 'Ada', injected: 'junk' }

            expect(stripToSchema(payload, schema)).toEqual({ id: 'a', name: 'Ada' })
        })
    })

    describe('schemas that allow their own extras', () => {
        it('should keep unnamed fields when additionalProperties is true', () => {
            const schema: JSONSchema = {
                type: 'object',
                properties: { id: { type: 'string' } },
                additionalProperties: true,
            }
            const payload: Payload = { id: 'a', extra: 'kept' }

            expect(stripToSchema(payload, schema)).toEqual({ id: 'a', extra: 'kept' })
        })

        it('should keep unnamed fields when additionalProperties is an open schema', () => {
            const schema: JSONSchema = {
                type: 'object',
                properties: { id: { type: 'string' } },
                additionalProperties: {},
            }
            const payload: Payload = { id: 'a', extra: 'kept' }

            expect(stripToSchema(payload, schema)).toEqual({ id: 'a', extra: 'kept' })
        })

        it('should apply the additionalProperties schema to the fields it allows', () => {
            const schema: JSONSchema = {
                type: 'object',
                additionalProperties: {
                    type: 'object',
                    properties: { name: { type: 'string' }, secret: { type: 'string', private: true } },
                    additionalProperties: false,
                },
            }
            const payload: Payload = { ada: { name: 'Ada', secret: 'shh', injected: 'junk' } }

            expect(stripToSchema(payload, schema)).toEqual({ ada: { name: 'Ada' } })
        })

        it('should keep everything when the schema describes no fields at all', () => {
            const payload: Payload = { anything: 'kept' }

            expect(stripToSchema(payload, { type: 'object' })).toEqual({ anything: 'kept' })
        })
    })

    describe('patternProperties', () => {
        it('should keep a field whose name matches a pattern and remove one that does not', () => {
            const schema: JSONSchema = {
                type: 'object',
                patternProperties: { '^x-': { type: 'string' } },
                additionalProperties: false,
            }
            const payload: Payload = { 'x-trace': 'abc', injected: 'junk' }

            expect(stripToSchema(payload, schema)).toEqual({ 'x-trace': 'abc' })
        })

        it('should apply the matching pattern schema to the field', () => {
            const schema: JSONSchema = {
                type: 'object',
                patternProperties: {
                    '^x-': {
                        type: 'object',
                        properties: { value: { type: 'string' }, secret: { type: 'string', private: true } },
                        additionalProperties: false,
                    },
                },
                additionalProperties: false,
            }
            const payload: Payload = { 'x-trace': { value: 'abc', secret: 'shh', injected: 'junk' } }

            expect(stripToSchema(payload, schema)).toEqual({ 'x-trace': { value: 'abc' } })
        })

        it('should ignore a pattern a JavaScript engine cannot compile', () => {
            const schema: JSONSchema = {
                type: 'object',
                properties: { id: { type: 'string' } },
                patternProperties: { '(?<': { type: 'string' } },
                additionalProperties: false,
            }
            const payload: Payload = { id: 'a', injected: 'junk' }

            expect(stripToSchema(payload, schema)).toEqual({ id: 'a' })
        })
    })

    describe('boolean property definitions', () => {
        it('should keep a property the schema allows without describing it', () => {
            const schema: JSONSchema = {
                type: 'object',
                properties: { anything: true },
                additionalProperties: false,
            }
            const payload: Payload = { anything: { deep: 'kept' } }

            expect(stripToSchema(payload, schema)).toEqual({ anything: { deep: 'kept' } })
        })

        it('should remove a property the schema forbids', () => {
            const schema: JSONSchema = {
                type: 'object',
                properties: { id: { type: 'string' }, banned: false },
                additionalProperties: false,
            }
            const payload: Payload = { id: 'a', banned: 'junk' }

            expect(stripToSchema(payload, schema)).toEqual({ id: 'a' })
        })
    })

    describe('private fields', () => {
        it('should remove private fields alongside the fields it does not describe', () => {
            const payload: Payload = { id: 'a', secret: 'shh', injected: 'junk' }

            expect(stripToSchema(payload, closedSchema)).toEqual({ id: 'a' })
        })

        it('should keep private fields when asked, and still remove the fields it does not describe', () => {
            const payload: Payload = { id: 'a', secret: 'shh', injected: 'junk' }

            expect(stripToSchema(payload, closedSchema, { includePrivateFields: true })).toEqual({
                id: 'a',
                secret: 'shh',
            })
        })

        it('should keep the fields it does not describe when asked', () => {
            const payload: Payload = { id: 'a', secret: 'shh', injected: 'junk' }

            expect(stripToSchema(payload, closedSchema, { stripUnknownFields: false })).toEqual({
                id: 'a',
                injected: 'junk',
            })
        })

        it('should return the payload untouched when it is asked to remove nothing', () => {
            const payload: Payload = { id: 'a', secret: 'shh', injected: 'junk' }

            expect(
                stripToSchema(payload, closedSchema, { stripUnknownFields: false, includePrivateFields: true }),
            ).toBe(payload)
        })
    })

    describe('values it must not rebuild', () => {
        it('should leave dates intact', () => {
            const when = new Date('2020-01-01T00:00:00.000Z')
            const schema: JSONSchema = {
                type: 'object',
                properties: { when: { type: 'string', format: 'date-time' } },
                additionalProperties: false,
            }
            const payload: Payload = { when, injected: 'junk' }

            expect(stripToSchema(payload, schema)).toEqual({ when })
        })

        it('should leave a value with its own prototype intact', () => {
            class ObjectId {
                constructor(public readonly bytes: string) {}
            }

            const id = new ObjectId('deadbeef')
            const schema: JSONSchema = {
                type: 'object',
                properties: { id: { type: 'object', properties: {}, additionalProperties: false } },
                additionalProperties: false,
            }
            const payload: Payload = { id }

            expect(stripToSchema(payload, schema).id).toBe(id)
        })

        it('should still remove private fields from a value with its own prototype', () => {
            class Row {
                constructor(
                    public name: string,
                    public secret: string,
                ) {}
            }

            const schema: JSONSchema = {
                type: 'object',
                properties: {
                    owner: {
                        type: 'object',
                        properties: { name: { type: 'string' }, secret: { type: 'string', private: true } },
                        additionalProperties: false,
                    },
                },
                additionalProperties: false,
            }
            const payload: Payload = { owner: new Row('Ada', 'shh') }

            expect(stripToSchema(payload, schema)).toEqual({ owner: { name: 'Ada' } })
        })
    })

    describe('copying', () => {
        it('should not modify the value it is given', () => {
            const original: Payload = { id: 'a', secret: 'shh', injected: 'junk' }

            stripToSchema(original, closedSchema)

            expect(original).toEqual({ id: 'a', secret: 'shh', injected: 'junk' })
        })

        it('should return the original value when there is nothing to remove', () => {
            const original: Payload = { id: 'a' }

            expect(stripToSchema(original, closedSchema)).toBe(original)
        })

        it('should return the value unchanged when no schema is given', () => {
            const original: Payload = { injected: 'junk' }

            expect(stripToSchema(original, undefined)).toBe(original)
        })

        it('should return non-objects unchanged', () => {
            expect(stripToSchema(null, closedSchema)).toBeNull()
            expect(stripToSchema('text', closedSchema)).toBe('text')
        })
    })
})

describe('stripPrivateValues', () => {
    it('should keep the fields the schema does not describe', () => {
        const payload: Payload = { id: 'a', secret: 'shh', injected: 'junk' }

        expect(stripPrivateValues(payload, closedSchema)).toEqual({ id: 'a', injected: 'junk' })
    })
})
