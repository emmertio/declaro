import type { DeclaroSchema } from './types'

export type Model<T extends DeclaroSchema.AnyObjectProperties> = {
    name: string
    schema: DeclaroSchema.SchemaObject<{
        [K in keyof T]: DeclaroSchema.SchemaObject<T[K]['properties']> & T[K]
    }>
    isModel: true
}

type TraverseSchemaFn<T extends DeclaroSchema.AnyObjectProperties> = (
    name: string,
    property: DeclaroSchema.SchemaObject<any>,
    schema: DeclaroSchema.SchemaObject<T>,
) => DeclaroSchema.SchemaObject<any>

function traverseSchema<T extends DeclaroSchema.AnyObjectProperties>(
    schema: DeclaroSchema.SchemaObject<T>,
    fn: TraverseSchemaFn<T>,
) {
    for (const [key, value] of Object.entries(schema.properties ?? {})) {
        let properties: DeclaroSchema.AnyObjectProperties = schema.properties
        properties[key] = fn(key, value, schema)
    }
}

export function initializeModel(schema: DeclaroSchema.SchemaObject<any>) {
    return schema
}

export function defineModel<T extends DeclaroSchema.AnyObjectProperties>(
    name: string,
    doc: DeclaroSchema.SchemaObject<T>,
): Model<T> {
    traverseSchema(doc, (name, property, schema) => {
        return initializeModel({
            propertyName: name,
            ...property,
        })
    })
    return {
        name,
        schema: { ...doc },
        isModel: true,
    }
}
