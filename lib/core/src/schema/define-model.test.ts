import { describe, expect, it } from 'vitest'
import { defineModel } from '.'

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
        expect(movie.schema.properties.title.labels.pluralSlug).toBe(undefined) // Only include explicitly defined labels—leave the rest up to the framework
    })
})
