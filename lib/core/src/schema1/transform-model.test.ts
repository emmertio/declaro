import { describe, expect, it } from 'vitest'
import { defineModel } from '.'
import { transformModel } from './transform-model'

describe('Transform models', async () => {
    it('should transform a model to typescript', async () => {
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

        const typescript = transformModel(movie).toTypescript()

        expect(typescript).toBe(
            `export class Movie {
    title: string;
    year: number;
}`,
        )
    })
})
