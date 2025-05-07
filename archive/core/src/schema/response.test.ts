import { describe, expect, it } from 'vitest'
import { Response } from './response'
import type { DeclaroSchema } from './types'

describe('Response schema', () => {
    it('should define a response schema', () => {
        const response = new Response(200, {
            description: 'Successful response',
        })
            .content('application/json', {
                schema: {
                    type: 'object',
                    properties: {
                        message: {
                            type: 'string',
                        },
                    },
                },
            })
            .content('application/xml', {
                schema: {
                    type: 'object',
                    properties: {
                        message: {
                            type: 'string',
                        },
                    },
                },
            })
            .content('application/json', {
                schema: {
                    type: 'object',
                    properties: {
                        error: {
                            type: 'string',
                        },
                    },
                },
            })
            .content('application/xml', {
                schema: {
                    type: 'object',
                    properties: {
                        error: {
                            type: 'string',
                        },
                    },
                },
            })

        expect(response.code).toBe(200)
        expect(response).toBeInstanceOf(Response)

        const jsonSchema = response.schema.content['application/json'].schema as DeclaroSchema.SchemaObject<any>
        expect(jsonSchema).toBeTypeOf('object')
        expect(jsonSchema.oneOf.length).toBe(2)
        expect((jsonSchema.oneOf[0] as any).properties.message.type).toBe('string')
        expect((jsonSchema.oneOf[1] as any).properties.error.type).toBe('string')
    })

    it('Should merge response schemas', () => {
        const response = new Response(200, {
            description: 'Successful response',
        }).content('application/json', {
            schema: {
                type: 'object',
                properties: {
                    message: {
                        type: 'string',
                    },
                },
            },
        })

        const response2 = new Response(200, {
            description: 'Successful response',
        }).content('application/xml', {
            schema: {
                type: 'object',
                properties: {
                    message: {
                        type: 'string',
                    },
                },
            },
        })

        response.merge(response2)

        expect(response.code).toBe(200)
        expect(response).toBeInstanceOf(Response)

        const jsonSchema = response.schema.content['application/json'].schema as DeclaroSchema.SchemaObject<any>
        expect(jsonSchema).toBeTypeOf('object')
        expect((jsonSchema as any).properties.message.type).toBe('string')

        const xmlSchema = response.schema.content['application/xml'].schema as DeclaroSchema.SchemaObject<any>
        expect(xmlSchema).toBeTypeOf('object')
        expect((xmlSchema as any).properties.message.type).toBe('string')
    })
})
