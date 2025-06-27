import type { StandardSchemaV1 } from '@standard-schema/spec'
import { describe, expect, it } from 'vitest'
import { z } from 'zod/v4'
import type { JSONSchema } from './json-schema'
import { Model } from './model'
import { ModelSchema } from './model-schema'

class MockModel<TName extends Readonly<string>, TSchema extends StandardSchemaV1> extends Model<TName, TSchema> {
    constructor(name: TName, schema: TSchema) {
        super(name, schema)
    }

    async toJSONSchema(): Promise<JSONSchema> {
        return {
            $id: `https://example.com/schemas/${this.name}.json`,
            type: 'object',
            properties: {},
            required: [],
        }
    }
}

describe('ModelSchema', () => {
    it('should create a ModelSchema instance', () => {
        const schema = ModelSchema.create('TestModel')
        expect(schema).toBeInstanceOf(ModelSchema)
        expect(schema.name).toBe('TestModel')
    })

    it('should support read definitions with MixinFactory', () => {
        const schema = ModelSchema.create('Book').read({
            detail: (h) => new MockModel(h.name, z.object({ id: z.string(), name: z.string() })),
            lookup: (h) => new MockModel(h.name, z.object({ id: z.string(), name: z.string() })),
        })

        expect(schema.definition.detail).toBeInstanceOf(MockModel)
        expect(schema.definition.lookup).toBeInstanceOf(MockModel)

        expect(schema.definition.detail.name).toBe('BookDetail')
        expect(schema.definition.lookup.name).toBe('BookLookup')
    })

    it('should support search definitions with MixinFactory', () => {
        const schema = ModelSchema.create('Book').search({
            filters: (h) =>
                new MockModel(h.name, z.object({ title: z.string().optional(), author: z.string().optional() })),
            listItem: (h) => new MockModel(h.name, z.object({ id: z.string(), title: z.string() })),
        })

        expect(schema.definition.filters).toBeInstanceOf(MockModel)
        expect(schema.definition.listItem).toBeInstanceOf(MockModel)
        expect(schema.definition.filters.name).toBe('BookFilters')
        expect(schema.definition.listItem.name).toBe('BookListItem')
    })

    it('should support write definitions with MixinFactory', () => {
        const schema = ModelSchema.create('Book').write({
            input: (h) => new MockModel(h.name, z.object({ title: z.string(), author: z.string() })),
        })

        expect(schema.definition.input).toBeInstanceOf(MockModel)
        expect(schema.definition.input.name).toBe('BookInput')
    })
})
