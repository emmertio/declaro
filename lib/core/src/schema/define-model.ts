import { OpenAPIV3_1 } from 'openapi-types'

export type Model = {
    name: string
    schema: OpenAPIV3_1.SchemaObject
}

export function defineModel(
    name: string,
    doc: OpenAPIV3_1.SchemaObject,
): Model {
    return {
        name,
        schema: doc,
    }
}
