import { type DeclaroSchema } from './types'

export const t = {
    string: <T extends DeclaroSchema.NonArraySchemaObject<any, any>>(property?: T) => {
        return {
            ...property,
            type: 'string' as const,
        }
    },
    number: <T extends DeclaroSchema.NonArraySchemaObject<any, any>>(property?: T) => {
        return {
            ...property,
            type: 'number' as const,
        }
    },
    boolean: <T extends DeclaroSchema.NonArraySchemaObject<any, any>>(property?: T) => {
        return {
            ...property,
            type: 'boolean' as const,
        }
    },
    integer: <T extends DeclaroSchema.NonArraySchemaObject<any, any>>(property?: T) => {
        return {
            ...property,
            type: 'integer' as const,
        }
    },
    object: <T extends DeclaroSchema.NonArraySchemaObject<any, any>>(property?: T) => {
        return {
            ...property,
            type: 'object' as const,
        }
    },
    array: <T extends DeclaroSchema.NonArraySchemaObject<any, any>>(property?: T) => {
        return {
            ...property,
            type: 'array' as const,
        }
    },
}
