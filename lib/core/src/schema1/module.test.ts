import { describe, expect, it } from 'vitest'
import { Module } from './module'
import { Application } from './application'

describe('Module definition', () => {
    it('should define a module', () => {
        const application = new Application({
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

        const module = new Module(application, {
            name: 'Module',

            description: 'Module description',
            externalDocs: {
                description: 'External documentation',
                url: 'https://example.com/docs',
            },
        })

        expect(module.application).toBeInstanceOf(Application)
        expect(module.application.info.title).toBe('My API')
        expect(module.application.info.version).toBe('1.0.0')
        expect(module.application.info.description).toBe('My API description')

        expect(module.tag.name).toBe('Module')
        expect(module.tag.description).toBe('Module description')
        expect(module.tag.externalDocs.description).toBe('External documentation')
        expect(module.tag.externalDocs.url).toBe('https://example.com/docs')
    })
})
