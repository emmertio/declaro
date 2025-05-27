import { z } from 'zod'
import 'zod-openapi/extend'

export type IsStringUnion<T> = T extends string
    ? T extends `${infer _}` // Check if T is a string literal
        ? true // If it is, return true
        : false // Otherwise, return false
    : false // If T is not a string, return false

export type TypeToZod<T> = IsStringUnion<T> extends true
    ? z.ZodEnum<[string, ...string[]]>
    : T extends string
    ? z.ZodString
    : T extends number
    ? z.ZodNumber
    : T extends boolean
    ? z.ZodBoolean
    : T extends Date
    ? z.ZodDate
    : T extends Array<any>
    ? z.ZodArray<any>
    : T extends Record<string, string>
    ? z.ZodEnum<[string, ...string[]]>
    : T extends object
    ? z.AnyZodObject
    : z.ZodTypeAny

export type OptionalField<T extends z.ZodTypeAny> = z.ZodOptional<T> | z.ZodNullable<T>

export type RequiredField<T extends z.ZodTypeAny> = T | z.ZodDefault<T>

export type FieldsShape<T> = {
    [K in keyof T]: z.ZodAny | undefined extends T[K] ? OptionalField<TypeToZod<T[K]>> : RequiredField<TypeToZod<T[K]>>
}

export function createZodSchema<T extends object>(definition: {
    class: new (...args: any[]) => T
    fields: FieldsShape<T>
    name?: string
}) {
    let schema = z.object(definition.fields)
    if (definition.name ?? definition.class.name) {
        schema = schema.openapi({
            title: definition.name ?? definition.class.name,
        })
    }
    return schema
}
