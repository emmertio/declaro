import { describe, expect, it } from 'vitest'
import { defineModel } from '.'

describe('Model definition', async () => {
    it('should define a model', async () => {
        const movie = defineModel('Movie', {
            type: 'object',
            properties: {
                title: {
                    type: 'string',
                },
                year: {
                    type: 'integer',
                    format: 'int32',
                },
            },
            required: ['title'],
        })

        expect(movie.name).toBe('Movie')
        expect(movie.schema).toEqual({
            type: 'object',
            properties: {
                title: {
                    type: 'string',
                },
                year: {
                    type: 'integer',
                    format: 'int32',
                },
            },
            required: ['title'],
        })
    })
})
