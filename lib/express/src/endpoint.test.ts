import { describe, expect, it, vi } from 'vitest'
import { Endpoint, type OperationFunction } from './endpoint'
import { Container } from '@declaro/di'
import { Application, type DeclaroSchema, ForbiddenError, t } from '@declaro/core'
import { httpRequestExtension } from './request-extension'

describe('Endpoint', () => {
    class GreetingService {
        greet(greeting: string, name: string, age: number) {
            return {
                greeting: `${greeting}, ${name}!`,
                age,
            }
        }
    }

    const app = new Application({
        title: 'Test App',
        version: '1.0.0',
        description: 'This is a test app',
    })

    const mod = app.defineModule({
        name: 'test',
        description: 'This is a test module',
    })

    it('should create a complete endpoint', () => {
        const endpoint = new Endpoint(mod, {
            context: (req) =>
                new Container().extend(httpRequestExtension(req)).provideValue('foo', 'Hello').provideValue('bar', 42),
            input: {
                name: {
                    in: 'query',
                    required: true,
                },
            },
            response: {
                type: 'object',
                properties: {
                    data: {
                        $ref: '#/components/schemas/SomeModel',
                    },
                },
            },
            info: {
                summary: 'Test endpoint',
                description: 'This is a test endpoint',
            },
        })

        expect(endpoint).toBeInstanceOf(Endpoint)
        expect(endpoint.schema.summary).toBe('Test endpoint')
        expect(endpoint.schema.description).toBe('This is a test endpoint')

        expect(endpoint.schema.parameters).toHaveLength(1)
        expect((endpoint.schema.parameters[0] as DeclaroSchema.ParameterObject).name).toBe('name')
        expect((endpoint.schema.parameters[0] as DeclaroSchema.ParameterObject).in).toBe('query')
        expect((endpoint.schema.parameters[0] as DeclaroSchema.ParameterObject).required).toBe(true)
    })

    it('should define a handler for an endpoint', async () => {
        const endpoint = new Endpoint(mod, {
            context: (req) =>
                new Container()
                    .extend(httpRequestExtension(req))
                    .provideValue('greeting', 'Hello')
                    .provideClass('greetingService', GreetingService),
            input: {
                name: {
                    in: 'query',
                    required: true,
                    schema: t.string(),
                },
                age: {
                    in: 'query',
                    required: true,
                    schema: t.number(),
                },
            },
            response: {
                type: 'object',
                properties: {
                    greeting: t.string(),
                    age: t.number(),
                },
            },
            info: {
                summary: 'Test endpoint',
                description: 'This is a test endpoint',
            },
        })

        const handler = endpoint.resolve(async ({ input, context }) => {
            return context.resolve('greetingService').greet(context.resolve('greeting'), input.name, input.age)
        }) as any

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
        expect(mockStatus.mock.results[0].value.statusCode).toBe(200)
        expect(mockJson).toHaveBeenCalledTimes(1)
        expect(mockJson.mock.results[0].value).toEqual({
            data: {
                greeting: 'Hello, Alice!',
                age: 42,
            },
        })
    })

    it('should extract parameters from a request', () => {
        const endpoint = new Endpoint(mod, {
            context: (req) =>
                new Container()
                    .extend(httpRequestExtension(req))
                    .provideValue('greeting', 'Hello')
                    .provideClass('greetingService', GreetingService),
            input: {
                name: {
                    in: 'query',
                    required: true,
                    schema: t.string(),
                },
                age: {
                    in: 'query',
                    required: true,
                    schema: t.number(),
                },
            },
            response: {
                type: 'object',
                properties: {
                    greeting: t.string(),
                    age: t.number(),
                },
            },
            info: {
                summary: 'Test endpoint',
                description: 'This is a test endpoint',
            },
        })

        const parameters = endpoint.extractParameters({
            query: {
                name: 'Alice',
                age: '42',
            },
        } as any)

        expect(parameters).toEqual({
            name: 'Alice',
            age: 42,
        })
    })

    it('should format errors properly', async () => {
        const endpoint = new Endpoint(mod, {
            context: (req) =>
                new Container()
                    .extend(httpRequestExtension(req))
                    .provideValue('greeting', 'Hello')
                    .provideClass('greetingService', GreetingService),
            input: {
                name: {
                    in: 'query',
                    required: true,
                    schema: t.string(),
                },
                age: {
                    in: 'query',
                    required: true,
                    schema: t.number(),
                },
            },
            response: {
                type: 'object',
                properties: {
                    greeting: t.string(),
                    age: t.number(),
                },
            },
            info: {
                summary: 'Test endpoint',
                description: 'This is a test endpoint',
            },
        })

        const handler = endpoint.resolve(async ({ input, context }) => {
            throw new ForbiddenError('You are not allowed to access this resource')
        }) as any

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
        expect(mockStatus.mock.results[0].value.statusCode).toBe(403)
        expect(mockJson).toHaveBeenCalledTimes(1)
        expect(mockJson.mock.results[0].value).toEqual({
            error: {
                code: 403,
                message: 'You are not allowed to access this resource',
            },
        })
    })

    it('should be able to incrementally build an endpoint', async () => {
        const endpoint = Endpoint.create(mod, {
            summary: 'Test endpoint',
            description: 'This is a test endpoint',
        })

        const withParameters = endpoint.input({
            name: {
                in: 'query',
                required: true,
                schema: t.string(),
            },
            age: {
                in: 'query',
                required: true,
                schema: t.number(),
            },
        })

        const withResponse = withParameters.output({
            type: 'object',
            properties: {
                greeting: t.string(),
                age: t.number(),
            },
        })

        const withContext = withResponse.context((req) =>
            new Container()
                .extend(httpRequestExtension(req))
                .provideValue('greeting', 'Hello')
                .provideClass('greetingService', GreetingService),
        )

        const withUpdatedInfo = withContext.setInfo({
            summary: 'Updated test endpoint',
        })

        const handler = withUpdatedInfo.resolve(async ({ input, context }) => {
            return context.resolve('greetingService').greet(context.resolve('greeting'), input.name, input.age)
        }) as any

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
        expect(mockStatus.mock.results[0].value.statusCode).toBe(200)
        expect(mockJson).toHaveBeenCalledTimes(1)
        expect(mockJson.mock.results[0].value).toEqual({
            data: {
                greeting: 'Hello, Alice!',
                age: 42,
            },
        })

        expect(endpoint.schema.summary).toBe('Test endpoint')
        expect(endpoint.schema.description).toBe('This is a test endpoint')

        expect(withParameters.schema.summary).toBe('Test endpoint')
        expect(withParameters.schema.description).toBe('This is a test endpoint')
        expect(withParameters.schema.parameters).toHaveLength(2)
        expect((withParameters.schema.parameters[0] as DeclaroSchema.ParameterObject).name).toBe('name')
        expect((withParameters.schema.parameters[0] as DeclaroSchema.ParameterObject).in).toBe('query')
        expect((withParameters.schema.parameters[0] as DeclaroSchema.ParameterObject).required).toBe(true)
        expect((withParameters.schema.parameters[1] as DeclaroSchema.ParameterObject).name).toBe('age')
        expect((withParameters.schema.parameters[1] as DeclaroSchema.ParameterObject).in).toBe('query')
        expect((withParameters.schema.parameters[1] as DeclaroSchema.ParameterObject).required).toBe(true)

        expect(withResponse.schema.summary).toBe('Test endpoint')
        expect(withResponse.schema.description).toBe('This is a test endpoint')
        expect(withResponse.schema.parameters).toHaveLength(2)
        expect((withResponse.schema.parameters[0] as DeclaroSchema.ParameterObject).name).toBe('name')
        expect((withResponse.schema.parameters[0] as DeclaroSchema.ParameterObject).in).toBe('query')
        expect((withResponse.schema.parameters[0] as DeclaroSchema.ParameterObject).required).toBe(true)
        expect((withResponse.schema.parameters[1] as DeclaroSchema.ParameterObject).name).toBe('age')
        expect((withResponse.schema.parameters[1] as DeclaroSchema.ParameterObject).in).toBe('query')
        expect((withResponse.schema.parameters[1] as DeclaroSchema.ParameterObject).required).toBe(true)
        expect(withResponse.schema.responses).toEqual({
            200: {
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                greeting: {
                                    type: 'string',
                                },
                                age: {
                                    type: 'number',
                                },
                            },
                        },
                    },
                },
                description: 'Successful response',
            },
        })
    })
})
