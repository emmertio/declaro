import type { DeclaroSchema } from './types'
import { mergician } from 'mergician'

export type Model<
    T extends DeclaroSchema.AnyObjectProperties = DeclaroSchema.AnyObjectProperties,
    N extends Readonly<string> = string,
> = {
    name: N
    schema: DeclaroSchema.SchemaObject<T>
    isModel: true
}

type TraverseSchemaFn<T extends DeclaroSchema.AnyObjectProperties> = (
    name: string,
    property: DeclaroSchema.SchemaObject<any>,
    schema: DeclaroSchema.SchemaObject<T>,
) => DeclaroSchema.SchemaObject<any>

export type ModelName<T extends Model<any, string>> = T['name']
export type ModelProperties<T extends Model<any, string>> = T['schema']['properties']

function traverseSchema<T extends DeclaroSchema.AnyObjectProperties>(
    schema: DeclaroSchema.SchemaObject<T>,
    fn: TraverseSchemaFn<T>,
) {
    for (const [key, value] of Object.entries(schema.properties ?? {})) {
        let properties: DeclaroSchema.AnyObjectProperties = schema.properties!
        properties[key] = fn(key, value, schema)
    }
}

export function initializeModel(schema: DeclaroSchema.SchemaObject<any>) {
    return schema
}

export function defineModel<T extends DeclaroSchema.AnyObjectProperties, N extends Readonly<string>>(
    name: N,
    doc: DeclaroSchema.SchemaObject<T>,
): Model<T, N> {
    traverseSchema(doc, (name, property, schema) => {
        return initializeModel({
            propertyName: name,
            ...property,
        })
    })
    return {
        name: name as Readonly<N>,
        schema: { ...doc },
        isModel: true,
    }
}

export function mergeModels<
    T1 extends DeclaroSchema.AnyObjectProperties,
    N extends Readonly<string>,
    T2 extends DeclaroSchema.AnyObjectProperties,
>(model1: Model<T1, N>, model2: Model<T2, N>): Model<T1 & T2, N> {
    return mergician(model1, model2) as any
}
