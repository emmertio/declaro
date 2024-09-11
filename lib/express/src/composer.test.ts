import { describe, expect, it, vi } from 'vitest'
import { ExpressComposer } from './composer'
import { Container } from '@declaro/di'
import { httpRequestExtension } from './request-extension'
import type { DeclaroSchema } from '@declaro/core/dist/schema/types'
import { Application, Response, t } from '@declaro/core'

describe('Express Composer', () => {
    const app = new Application({
        title: 'Test App',
        version: '1.0.0',
        description: 'This is a test app',
    })

    it('should compose an endpoint', async () => {
        const mod = app.defineModule({
            name: 'test',
            description: 'This is a test module',
        })

        const composer = new ExpressComposer(mod, (req) => {
            return new Container()
                .extend(httpRequestExtension(req))
                .provideValue('Express.Request', req)
                .provideValue('greeting', 'Hello')
        })

        const endpoint = composer
            .endpoint({
                summary: 'Test',
                description: 'This is a test',
            })
            .input({
                name: {
                    schema: t.string(),
                    in: 'query',
                },
                age: {
                    schema: t.number({
                        title: 'Age',
                    }),
                    in: 'query',
                },
            })
            .output({
                type: 'object',
                properties: {
                    message: {
                        type: 'string',
                    },
                },
            })

        const handler = endpoint.resolve(async ({ input, context }) => {
            const greeting = context.resolve('greeting')
            return {
                message: `${greeting} ${input.name}! You are ${input.age} years old.`,
            }
        }) as any

        expect(endpoint.schema.summary).toBe('Test')
        expect(endpoint.schema.description).toBe('This is a test')
        expect(endpoint.schema.tags[0]).toBe('test')
        expect(endpoint.schema.parameters.length).toBe(2)
        expect(endpoint.schema.parameters[0].name).toBe('name')
        expect((endpoint.schema.parameters[0].schema as DeclaroSchema.SchemaObject<any>).type).toBe('string')
        expect(endpoint.schema.parameters[1].name).toBe('age')
        expect((endpoint.schema.parameters[1].schema as DeclaroSchema.SchemaObject<any>).type).toBe('number')
        expect((endpoint.schema.parameters[1].schema as DeclaroSchema.SchemaObject<any>).title).toBe('Age')
        expect(endpoint.schema.responses[200].description).toBe('Successful response')
        expect(
            (
                (endpoint.schema.responses[200] as DeclaroSchema.ResponseObject).content['application/json']
                    .schema as DeclaroSchema.SchemaObject<any>
            ).properties.message.type,
        ).toBe('string')

        const mockStatus = vi.fn((code: number) => {
            return {
                json: mockJson,
                statusCode: code,
            }
        })
        const mockJson = vi.fn((response: any) => {
            return response
        })

        await handler(
            {
                query: {
                    name: 'Alice',
                    age: 42,
                },
            },
            {
                status: mockStatus,
                json: mockJson,
            },
        )

        expect(mockStatus).toHaveBeenCalledTimes(1)
        expect(mockStatus).toHaveBeenCalledWith(200)
        expect(mockJson).toHaveBeenCalledTimes(1)
        expect(mockJson).toHaveBeenCalledWith({
            data: {
                message: 'Hello Alice! You are 42 years old.',
            },
        })
    })
})
