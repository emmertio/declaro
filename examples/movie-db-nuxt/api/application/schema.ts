import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'
import { TableSchema } from '@declaro/db-drizzle'
import { pascalCase } from 'change-case'

export function registerSchemas(...schemas: TableSchema<any>[]) {
    return (registry: OpenAPIRegistry) => {
        for (const schema of schemas) {
            registry.register(pascalCase(schema.insert._def.openapi?.metadata?.title!), schema.insert)
            registry.register(pascalCase(schema.select._def.openapi?.metadata?.title!), schema.select)
        }

        return registry
    }
}
