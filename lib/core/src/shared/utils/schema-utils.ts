import type { JSONSchema } from 'src/schema/json-schema'

export function stripPrivateFieldsFromSchema(schema: JSONSchema): JSONSchema {
    if (typeof schema?.properties === 'object') {
        for (const key of Object.keys(schema.properties)) {
            const property = schema.properties[key]
            if (typeof property === 'object') {
                if (property.private === true) {
                    delete schema.properties[key]
                } else {
                    stripPrivateFieldsFromSchema(property)
                }
            }
        }
    }
    return schema
}
