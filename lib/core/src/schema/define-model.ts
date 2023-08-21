import { OpenAPIV3, type OpenAPIV3_1 } from 'openapi-types'
import type { DeclaroSchema } from './types'

export type Model = {
    name: string
    schema: DeclaroSchema.SchemaObject
    isModel: true
}

export function defineModel(
    name: string,
    doc: DeclaroSchema.SchemaObject,
): Model {
    return {
        name,
        schema: doc,
        isModel: true,
    }
}
