import { describe, expect, it } from 'vitest'
import { Application } from './application'
import { Module } from './module'
import { defineModel } from './define-model'
import type { OpenAPIV3_1 } from 'openapi-types'
import { Response } from './response'

describe('Application schema', () => {
    it('should define an application schema', () => {
        const app = new Application({
            title: 'My API',
            version: '1.0.0',
            description: 'My API description',
            termsOfService: 'https://example.com/terms',
            contact: {
                name: 'API Support',
                url: 'https://example.com/support',
                email: 'test@test.com',
            },
        })

        expect(app.info.title).toBe('My API')
        expect(app.info.version).toBe('1.0.0')
        expect(app.info.description).toBe('My API description')
        expect(app.info.termsOfService).toBe('https://example.com/terms')
        expect(app.info.contact.name).toBe('API Support')
        expect(app.info.contact.url).toBe('https://example.com/support')
        expect(app.info.contact.email).toBe('test@test.com')
    })

    it('should be able to add a module', () => {
        const app = new Application({
            title: 'My API',
            version: '1.0.0',
            description: 'My API description',
            termsOfService: 'https://example.com/terms',
            contact: {
                name: 'API Support',
                url: 'https://example.com/support',
                email: 'test@test.com',
            },
        })

        const result = app.defineModule({
            name: 'Module',
            description: 'Module description',
            externalDocs: {
                description: 'External documentation',
                url: 'https://example.com/docs',
            },
        })

        expect(result).toBeInstanceOf(Module)

        const module = app.getModule('Module')

        expect(module).toBeInstanceOf(Module)

        expect(module.application).toBeInstanceOf(Application)
        expect(module.application.info.title).toBe('My API')
        expect(module.application.info.version).toBe('1.0.0')

        expect(module).toBeInstanceOf(Module)
        expect(module.tag.name).toBe('Module')
        expect(module.tag.description).toBe('Module description')
        expect(module.tag.externalDocs.description).toBe('External documentation')
    })

    it('Should allow multiple module definitions to be chained', () => {
        const app = new Application({
            title: 'My API',
            version: '1.0.0',
            description: 'My API description',
            termsOfService: 'https://example.com/terms',
            contact: {
                name: 'API Support',
                url: 'https://example.com/support',
                email: 'test@test.com',
            },
        })

        app.defineModule({
            name: 'Module1',
            description: 'Module 1 description',
            externalDocs: {
                description: 'External documentation 1',
                url: 'https://example.com/docs1',
            },
        })
        app.defineModule({
            name: 'Module2',
            description: 'Module 2 description',
            externalDocs: {
                description: 'External documentation 2',
                url: 'https://example.com/docs2',
            },
        })

        const module1 = app.getModule('Module1')
        const module2 = app.getModule('Module2')

        expect(module1.tag.name).toBe('Module1')
        expect(module1.tag.description).toBe('Module 1 description')
        expect(module1.tag.externalDocs.description).toBe('External documentation 1')
        expect(module1.tag.externalDocs.url).toBe('https://example.com/docs1')

        expect(module2.tag.name).toBe('Module2')
        expect(module2.tag.description).toBe('Module 2 description')
        expect(module2.tag.externalDocs.description).toBe('External documentation 2')
        expect(module2.tag.externalDocs.url).toBe('https://example.com/docs2')
    })

    it('Should allow models to be added to the application', () => {
        const app = new Application({
            title: 'My API',
            version: '1.0.0',
            description: 'My API description',
            termsOfService: 'https://example.com/terms',
            contact: {
                name: 'API Support',
                url: 'https://example.com/support',
                email: 'test@test.com',
            },
        })

        const model1 = defineModel('Model1', {
            type: 'object',
            properties: {
                name: {
                    type: 'string',
                },
            },
        })

        const model2 = defineModel('Model2', {
            type: 'object',
            properties: {
                number: {
                    type: 'integer',
                },
            },
        })

        app.addModel(model1, model2)

        const allModels = app.getModels()

        expect(allModels).toHaveLength(2)

        expect(allModels[0].name).toBe('Model1')
        expect(allModels[1].name).toBe('Model2')
    })

    it('Should allow responses to be added to the application', () => {
        const app = new Application({
            title: 'My API',
            version: '1.0.0',
            description: 'My API description',
            termsOfService: 'https://example.com/terms',
            contact: {
                name: 'API Support',
                url: 'https://example.com/support',
                email: 'test@test.com',
            },
        })

        const error500 = new Response(500, {
            description: 'Internal server error',
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

        const error404 = new Response(404, {
            description: 'Not found',
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

        const error400 = new Response(400, {
            description: 'Bad request',
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

        app.addResponse(error500, error404, error400)

        const response500 = app.getResponse(500)
        const response404 = app.getResponse(404)
        const response400 = app.getResponse(400)

        const allResponses = app.getResponseSchema()

        expect(response500.code).toBe(500)
        expect(response500.schema.description).toBe('Internal server error')

        expect(response404.code).toBe(404)
        expect(response404.schema.description).toBe('Not found')

        expect(response400.code).toBe(400)
        expect(response400.schema.description).toBe('Bad request')

        expect(allResponses[500].description).toBe('Internal server error')
        expect((allResponses[500] as any).content['application/json'].schema.type).toBe('object')
        expect((allResponses[500] as any).content['application/json'].schema.properties.message.type).toBe('string')

        expect(allResponses[404].description).toBe('Not found')
        expect((allResponses[404] as any).content['application/json'].schema.type).toBe('object')
        expect((allResponses[404] as any).content['application/json'].schema.properties.message.type).toBe('string')

        expect(allResponses[400].description).toBe('Bad request')
        expect((allResponses[400] as any).content['application/json'].schema.type).toBe('object')
        expect((allResponses[400] as any).content['application/json'].schema.properties.message.type).toBe('string')
    })

    it('Should allow paths to be added to the application', () => {
        function test(doc: OpenAPIV3_1.Document) {}

        test({
            openapi: '3.0.0',
            info: {
                title: 'My API',
                version: '1.0.0',
            },
            paths: {
                '/test': {
                    get: {
                        description: 'Test endpoint',
                        responses: {
                            200: {
                                description: 'Successful response',
                                content: {
                                    'application/json': {
                                        schema: {
                                            oneOf: [
                                                {
                                                    type: 'object',
                                                    properties: {
                                                        message: {
                                                            type: 'string',
                                                        },
                                                    },
                                                },
                                                {
                                                    type: 'object',
                                                    properties: {
                                                        error: {
                                                            type: 'string',
                                                        },
                                                    },
                                                },
                                            ],
                                        },
                                    },
                                },
                            },
                            500: {
                                description: 'Internal server error',
                            },
                        },
                    },
                },
            },
        })
    })
})
