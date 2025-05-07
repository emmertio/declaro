import { describe, it } from 'vitest'
import { defineModel } from './define-model'
import type { DeclaroSchema } from './types'
import { t } from './properties'

describe('Type tests', () => {
    it('should infer payload types', () => {
        const model = defineModel('Test', {
            type: 'object',
            properties: {
                foo: t.string(),
                bar: t.object({
                    properties: {
                        baz: t.integer(),
                    },
                }),
            },
        })

        const bazModel = defineModel('Baz', {
            properties: {
                baz: {
                    type: 'integer',
                },
            },
        })
    })
})
