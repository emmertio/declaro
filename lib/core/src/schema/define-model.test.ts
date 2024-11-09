import { describe, expect, it } from 'vitest'
import { defineModel, extendModel, mergeModels, type ModelName, type ModelProperties } from '.'
import { t } from './properties'

describe('Model definition', async () => {
    it('should define a model', async () => {
        const movie = defineModel('Movie', {
            type: 'object',
            properties: {
                title: {
                    type: 'string',
                    labels: {
                        singularEntityName: 'Title',
                        pluralEntityName: 'Titles',
                    },
                },
                year: {
                    type: 'integer',
                    format: 'int32',
                },
            },
            required: ['title'],
            labels: {
                singularEntityName: 'Movie',
                pluralEntityName: 'Movies',
            },
        })

        const name: ModelName<typeof movie> = movie.name
        const properties: ModelProperties<typeof movie> = movie.schema.properties

        expect(name).toBe('Movie')
        expect(properties.title.type).toBe('string')

        expect(movie.name).toBe('Movie')
        expect(movie.isModel).toBe(true)
        expect(movie.schema.type).toBe('object')
        expect(movie.schema.properties.title['type']).toBe('string')
        expect(movie.schema.properties.year['type']).toBe('integer')
        expect(movie.schema.properties.year['format']).toBe('int32')
        expect(movie.schema.required).toEqual(['title'])
        expect(movie.schema.labels).toBeTypeOf('object')
        expect(movie.schema.labels.pluralEntityName).toBe('Movies')
        expect(movie.schema.labels.singularEntityName).toBe('Movie')

        expect(movie.schema.properties.title.labels).toBeTypeOf('object')
        expect(movie.schema.properties.title.labels.pluralEntityName).toBe('Titles')
        expect(movie.schema.properties.title.labels.singularEntityName).toBe('Title')
        expect((movie.schema.properties.title.labels as any).pluralSlug).toBe(undefined) // Only include explicitly defined labels—leave the rest up to the framework
    })

    it('should define a model with nested properties', async () => {
        const movie = defineModel('Movie', {
            type: 'object',
            properties: {
                title: {
                    type: 'string',
                    labels: {
                        singularEntityName: 'Title',
                        pluralEntityName: 'Titles',
                    },
                },
                year: {
                    type: 'integer',
                    format: 'int32',
                },
                meta: {
                    type: 'object',
                    properties: {
                        rating: t.integer(),
                    },
                },
            },
            required: ['title'],
            labels: {
                singularEntityName: 'Movie',
                pluralEntityName: 'Movies',
            },
        })

        expect(movie.schema.properties.meta.type).toBe('object')
        expect(movie.schema.properties.meta.properties.rating.type).toBe('integer')
    })

    it('should merge models', async () => {
        const base = defineModel('Movie', {
            type: 'object',
            properties: {
                title: {
                    type: 'string',
                    labels: {
                        singularEntityName: 'Title',
                        pluralEntityName: 'Titles',
                    },
                },
                year: {
                    type: 'integer',
                    format: 'int32',
                },
                meta: {
                    type: 'object',
                    properties: {
                        rating: t.integer(),
                    },
                },
            },
            required: ['title'],
            labels: {
                singularEntityName: 'Movie',
                pluralEntityName: 'Movies',
            },
        })

        const annotation = defineModel('Movie', {
            type: 'object',
            properties: {
                rating: {
                    type: 'integer',
                    format: 'int32',
                },
            },
        })

        const merged = mergeModels(base, annotation)

        expect(merged.schema.properties.title.type).toBe('string')
        expect(merged.schema.properties.year.type).toBe('integer')
        expect(merged.schema.properties.meta.properties.rating.type).toBe('integer')
        expect(merged.schema.properties.rating.type).toBe('integer')
    })

    it('should extend existing models', async () => {
        const base = defineModel('Movie', {
            type: 'object',
            properties: {
                title: {
                    type: 'string',
                    minimum: 3,
                    labels: {
                        singularEntityName: 'Title',
                        pluralEntityName: 'Titles',
                    },
                },
                year: {
                    type: 'integer',
                    format: 'int32',
                },
                meta: {
                    type: 'object',
                    properties: {
                        rating: t.integer(),
                    },
                },
            },
            required: ['title'],
            labels: {
                singularEntityName: 'Movie',
                pluralEntityName: 'Movies',
            },
        })

        const extended = extendModel(base, {
            type: 'object',
            properties: {
                foo: {
                    type: 'string',
                },
                title: {
                    type: 'string',
                    maximum: 100,
                },
            },
        })

        expect(extended.schema.properties.title.minimum).toBe(3)
        expect(extended.schema.properties.title.maximum).toBe(100)
        expect(extended.schema.properties.foo.type).toBe('string')
        expect(extended.schema.properties.year.type).toBe('integer')
    })
})
