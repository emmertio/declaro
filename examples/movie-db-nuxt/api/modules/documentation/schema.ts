import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi'
import { OpenAPIObjectConfigV31 } from '@asteasolutions/zod-to-openapi/dist/v3.1/openapi-generator'
import { Router } from 'express'
import SwaggerUI from 'swagger-ui-express'

export function schemaGenerator(registry: OpenAPIRegistry) {
    return new OpenApiGeneratorV31(registry.definitions)
}

export function generateOpenApiDoc(generator: OpenApiGeneratorV31, appDescription: OpenAPIObjectConfigV31) {
    return generator.generateDocument(appDescription)
}

export function createSwaggerRouter(registry: OpenAPIRegistry, appDescription: OpenAPIObjectConfigV31) {
    const router = Router()

    const generator = schemaGenerator(registry)
    const openApiDoc = generateOpenApiDoc(generator, appDescription)

    router.get('/swagger.json', (req, res) => {
        res.status(200).json(openApiDoc)
    })

    router.use('/', SwaggerUI.serve)
    router.get('/', SwaggerUI.setup(openApiDoc))

    return router
}
