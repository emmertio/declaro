import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'
import { Container, defer } from '@declaro/di'
import { createSwaggerRouter, generateOpenApiDoc, schemaGenerator } from './schema'

import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'
import { OpenAPIObjectConfigV31 } from '@asteasolutions/zod-to-openapi/dist/v3.1/openapi-generator'

extendZodWithOpenApi(z)

export const documentationContainer = new Container()
    .requireDependency('OpenAPIAppDescription', defer<OpenAPIObjectConfigV31>())
    .provideFactory('OpenAPIRegistry', () => new OpenAPIRegistry(), [])
    .provideFactory('OpenApiGeneratorV31', schemaGenerator, ['OpenAPIRegistry'])
    .provideFactory('OpenApiDoc', generateOpenApiDoc, ['OpenApiGeneratorV31'])
    .provideFactory('DocumentationRouter', createSwaggerRouter, ['OpenAPIRegistry', 'OpenAPIAppDescription'])
