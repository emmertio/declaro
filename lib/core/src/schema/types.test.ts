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

        const test = {} as any as DeclaroSchema.ObjectPayload<(typeof model)['schema']['properties']>

        const foo = test.foo
        const bar = test.bar
        const baz = bar.baz

        const baz2 = {} as any as (typeof model)['schema']['properties']['bar']['properties']
        const baz3 = {} as any as DeclaroSchema.ObjectPayload<(typeof bazModel)['schema']['properties']>

        const bval1 = baz2.baz
        const bval2 = baz3.baz
    })
})
