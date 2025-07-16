import { describe, expect, it } from 'vitest'
import { z } from 'zod/v4'
import { ModelSchema, type MergeMixins } from './model-schema'
import { MockModel } from './test/mock-model'
import type { InferModelOutput } from './model'
import type { ShallowMerge, UniqueKeys } from '../typescript'

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

        const X = {} as any as InferModelOutput<(typeof schema)['definition']['lookup']>

        expect(schema.definition.detail.name).toBe('BookDetail')
        expect(schema.definition.lookup.name).toBe('BookLookup')
    })

    it('should support search definitions with MixinFactory', () => {
        const schema = ModelSchema.create('Book').search({
            filters: (h) =>
                new MockModel(h.name, z.object({ title: z.string().optional(), author: z.string().optional() })),
            summary: (h) => new MockModel(h.name, z.object({ id: z.string(), title: z.string() })),
            sort: (h) =>
                new MockModel(h.name, z.object({ title: z.enum(['asc', 'desc']), author: z.enum(['asc', 'desc']) })),
        })

        expect(schema.definition.filters).toBeInstanceOf(MockModel)
        expect(schema.definition.summary).toBeInstanceOf(MockModel)
        expect(schema.definition.filters.name).toBe('BookFilters')
        expect(schema.definition.summary.name).toBe('BookSummary')
    })

    it('should support write definitions with MixinFactory', () => {
        const schema = ModelSchema.create('Book').write({
            input: (h) => new MockModel(h.name, z.object({ title: z.string(), author: z.string() })),
        })

        expect(schema.definition.input).toBeInstanceOf(MockModel)
        expect(schema.definition.input.name).toBe('BookInput')
    })

    it('should define a primary key', () => {
        const schema = ModelSchema.create('Book')
            .read({
                detail: (h) => new MockModel(h.name, z.object({ id: z.string(), name: z.string() })),
                lookup: (h) => new MockModel(h.name, z.object({ id: z.string(), name: z.string() })),
            })
            .write({
                input: (h) => new MockModel(h.name, z.object({ id: z.string(), title: z.string() })),
            })
            .entity({
                primaryKey: 'id',
            })

        expect(schema.getEntityMetadata().primaryKey).toBe('id')
    })

    it('should allow redefinition of types', () => {
        const schema = ModelSchema.create('Book')
            .read({
                detail: (h) => new MockModel(h.name, z.object({ id: z.string(), name: z.string() })),
                lookup: (h) => new MockModel(h.name, z.object({ id: z.string(), name: z.string() })),
            })
            .write({
                input: (h) => new MockModel(h.name, z.object({ id: z.string(), title: z.string() })),
            })
            .entity({
                primaryKey: 'id',
            })

        const redefinedSchema = schema.read({
            detail: (h) =>
                new MockModel(
                    h.name,
                    z.object({ id: z.number(), name: z.string().optional(), age: z.number().optional() }),
                ),
            lookup: (h) => new MockModel(h.name, z.object({ id: z.number() })),
        })

        const patchedSchema = redefinedSchema.custom({
            detail: () =>
                new MockModel(
                    'BookDetail',
                    z.object({ id: z.string(), name: z.string(), foo: z.string(), bar: z.string() }),
                ),
        })

        const detailSchema = redefinedSchema.definition.detail.toJSONSchema()
        const patchedDetailSchema = patchedSchema.definition.detail.toJSONSchema()

        expect(redefinedSchema.definition.detail).toBeInstanceOf(MockModel)
        expect(Object.keys(detailSchema.properties ?? {})).toEqual(['id', 'name', 'age'])

        expect(Object.keys(patchedDetailSchema.properties ?? {})).toEqual(['id', 'name', 'foo', 'bar'])
    })

    it('should be able to redefine schema without changes to the primary key', () => {
        const schema = ModelSchema.create('Book')
            .read({
                detail: (h) => new MockModel(h.name, z.object({ id: z.string(), name: z.string() })),
                lookup: (h) => new MockModel(h.name, z.object({ id: z.string(), name: z.string() })),
            })
            .write({
                input: (h) => new MockModel(h.name, z.object({ id: z.string(), title: z.string() })),
            })
            .entity({
                primaryKey: 'id',
            })
            .read({
                detail: (h) => new MockModel(h.name, z.object({ uuid: z.string(), name: z.string() })),
                lookup: (h) => new MockModel(h.name, z.object({ uuid: z.string(), name: z.string() })),
            })

        expect(schema.getEntityMetadata().primaryKey).toBe('id')
    })
})
