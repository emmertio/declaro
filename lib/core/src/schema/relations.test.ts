import { describe, expect, it } from 'vitest'
import { defineModel, extendModel } from './define-model'
import { RelationFormat } from './formats'

describe('Relations', async () => {
    it('should define a many-to-many relation', async () => {
        const movie = defineModel('Movie', () => ({
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
                princesses: {
                    type: 'array',
                    format: RelationFormat.ManyToMany,
                    items: princess.reference,
                },
            },
            required: ['title'],
            labels: {
                singularEntityName: 'Movie',
                pluralEntityName: 'Movies',
            },
        }))

        const princess = defineModel('Princess', () => ({
            type: 'object',
            properties: {
                name: {
                    type: 'string',
                },
                favoriteColor: {
                    type: 'string',
                },
                movies: {
                    type: 'array',
                    format: RelationFormat.ManyToMany,
                    items: movie.reference,
                },
            },
        }))

        const princessRef: 'Princess' = movie.schema.properties.princesses.items.$ref
        const movieRef: 'Movie' = princess.schema.properties.movies.items.$ref

        expect(movie.schema.properties.princesses.type).toBe('array')
        expect(movie.schema.properties.princesses.format).toBe(RelationFormat.ManyToMany)
        expect(princessRef).toBe('Princess')
        expect(movieRef).toBe('Movie')
    })
})
