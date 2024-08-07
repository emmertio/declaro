import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'
import { Container, defer } from '@declaro/di'
import { registerSchemas } from '~/api/application/schema'
import { personSchema } from './models/person'

export const personContainer = new Container()
    .requireDependency('OpenAPIRegistry', defer<OpenAPIRegistry>())
    .middleware('OpenAPIRegistry', registerSchemas(personSchema))
