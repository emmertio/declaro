import type { JSONSchema, JSONSchemaDefinition } from '../../schema/json-schema'

/**
 * Guards against schemas that reference themselves, directly or through a chain of `$ref`
 * pointers. Real payloads never nest this deeply.
 */
const MAX_SCHEMA_DEPTH = 100

/**
 * Keywords whose values are alternative schemas for the same value.
 */
const BRANCH_KEYWORDS = ['anyOf', 'oneOf', 'allOf'] as const

/**
 * Narrows a JSON Schema definition to an object schema.
 * A definition may also be a boolean, which carries no field information.
 * @param definition The definition to narrow.
 * @returns The object schema, or undefined if the definition is a boolean.
 */
function asSchemaObject(definition?: JSONSchemaDefinition): JSONSchema | undefined {
    return typeof definition === 'object' && definition !== null ? definition : undefined
}

/**
 * Resolves a local JSON pointer such as `#/$defs/User` against the root schema.
 * @param pointer The pointer to resolve.
 * @param root The schema the pointer is relative to.
 * @returns The referenced schema, or undefined if it cannot be resolved.
 */
function resolvePointer(pointer: string, root?: JSONSchema): JSONSchema | undefined {
    if (!root) {
        return undefined
    }

    // A bare fragment points at the root document, which is how self-referencing schemas such as
    // a category tree describe their own children.
    if (pointer === '#' || pointer === '#/') {
        return root
    }

    if (!pointer.startsWith('#/')) {
        return undefined
    }

    const segments = pointer
        .slice(2)
        .split('/')
        .map((segment) => decodeURIComponent(segment).replace(/~1/g, '/').replace(/~0/g, '~'))

    let current: unknown = root
    for (const segment of segments) {
        if (typeof current !== 'object' || current === null) {
            return undefined
        }
        current = (current as Record<string, unknown>)[segment]
    }

    return asSchemaObject(current as JSONSchemaDefinition)
}

/**
 * Follows `$ref` pointers until an inline schema is reached.
 * @param schema The schema that may be a reference.
 * @param root The schema references are relative to.
 * @returns The referenced schema, or the original if it is not a reference.
 */
function dereference(schema: JSONSchema, root?: JSONSchema): JSONSchema {
    let current = schema

    for (let depth = 0; typeof current.$ref === 'string' && depth < MAX_SCHEMA_DEPTH; depth++) {
        const resolved = resolvePointer(current.$ref, root)
        if (!resolved) {
            return current
        }
        current = resolved
    }

    return current
}

/**
 * Collects every schema that can describe a value, flattening `$ref` pointers and the
 * `anyOf`/`oneOf`/`allOf` branches beneath them.
 *
 * A value is checked against all of its branches so that a field marked private in any one of
 * them is treated as private. Unions therefore fail closed.
 *
 * @param schema The schema to flatten.
 * @param root The schema references are relative to.
 * @returns Every applicable schema, including the schema itself.
 */
function collectApplicableSchemas(schema: JSONSchema, root?: JSONSchema): JSONSchema[] {
    const collected: JSONSchema[] = []
    const visited = new Set<JSONSchema>()

    const visit = (candidate: JSONSchema, depth: number) => {
        if (depth >= MAX_SCHEMA_DEPTH) {
            return
        }

        const resolved = dereference(candidate, root)
        if (visited.has(resolved)) {
            return
        }

        visited.add(resolved)
        collected.push(resolved)

        for (const keyword of BRANCH_KEYWORDS) {
            const branches = resolved[keyword]
            if (!Array.isArray(branches)) {
                continue
            }

            for (const branch of branches) {
                const branchSchema = asSchemaObject(branch)
                if (branchSchema) {
                    visit(branchSchema, depth + 1)
                }
            }
        }
    }

    visit(schema, 0)

    return collected
}

/**
 * The field names a schema marks private, and the schema describing each remaining field.
 */
interface ISchemaFields {
    privateKeys: Set<string>
    propertySchemas: Map<string, JSONSchema>
    /**
     * Every name the schema lists under `properties`, including those whose definition is a
     * boolean and so carries no shape of its own.
     */
    namedKeys: Set<string>
    /**
     * Patterns matching property names the schema describes, with the shape each one follows.
     */
    patternSchemas: { pattern: RegExp; schema: JSONSchema | undefined }[]
    /**
     * The schema every unnamed property follows, when the schema allows them with a shape.
     */
    additionalSchema: JSONSchema | undefined
    /**
     * Whether a property the schema does not describe is removed rather than kept.
     */
    isClosed: boolean
}

/**
 * Compiles a `patternProperties` key, ignoring patterns a JavaScript engine cannot parse.
 * @param pattern The regular expression source from the schema.
 * @returns The compiled expression, or undefined if it is not valid.
 */
function compilePattern(pattern: string): RegExp | undefined {
    try {
        return new RegExp(pattern, 'u')
    } catch {
        return undefined
    }
}

/**
 * Reads the private field names and per-field schemas from every applicable schema branch, along
 * with whether the schema closes the object to properties it does not describe.
 *
 * A schema is closed when it describes its fields and no applicable branch allows extras. A branch
 * that allows extras therefore opens the whole union, so a payload is never stripped on the
 * strength of a branch it does not match.
 *
 * @param schema The schema to read.
 * @param root The schema references are relative to.
 * @returns The private field names, the schema for each field, and whether extras are removed.
 */
function readSchemaFields(schema: JSONSchema, root?: JSONSchema): ISchemaFields {
    const privateKeys = new Set<string>()
    const propertySchemas = new Map<string, JSONSchema>()
    const namedKeys = new Set<string>()
    const patternSchemas: { pattern: RegExp; schema: JSONSchema | undefined }[] = []

    let additionalSchema: JSONSchema | undefined = undefined
    let describesFields = false
    let allowsAdditional = false
    let forbidsAdditional = false

    for (const applicable of collectApplicableSchemas(schema, root)) {
        if (applicable.properties || applicable.patternProperties) {
            describesFields = true
        }

        if (applicable.additionalProperties === false) {
            forbidsAdditional = true
        } else if (applicable.additionalProperties !== undefined) {
            allowsAdditional = true
            additionalSchema ??= asSchemaObject(applicable.additionalProperties)
        }

        for (const [key, definition] of Object.entries(applicable.properties ?? {})) {
            // A property listed as `false` describes a field the schema forbids, so it is not one
            // of the names a payload may keep.
            if (definition !== false) {
                namedKeys.add(key)
            }

            const property = asSchemaObject(definition)
            if (!property) {
                continue
            }

            if (property.private === true || dereference(property, root).private === true) {
                privateKeys.add(key)
            }

            if (!propertySchemas.has(key)) {
                propertySchemas.set(key, property)
            }
        }

        for (const [source, definition] of Object.entries(applicable.patternProperties ?? {})) {
            const pattern = definition === false ? undefined : compilePattern(source)
            if (pattern) {
                patternSchemas.push({ pattern, schema: asSchemaObject(definition) })
            }
        }
    }

    return {
        privateKeys,
        propertySchemas,
        namedKeys,
        patternSchemas,
        additionalSchema,
        isClosed: !allowsAdditional && (describesFields || forbidsAdditional),
    }
}

/**
 * Finds the schema describing a property the schema does not list under `properties`.
 * @param key The property name.
 * @param fields The fields read from the schema.
 * @returns Whether the schema describes the property, and the shape it follows if it has one.
 */
function readUnnamedField(key: string, fields: ISchemaFields): { isDescribed: boolean; schema?: JSONSchema } {
    for (const { pattern, schema } of fields.patternSchemas) {
        if (pattern.test(key)) {
            return { isDescribed: true, schema }
        }
    }

    return { isDescribed: !fields.isClosed, schema: fields.additionalSchema }
}

/**
 * Determines whether a value's own keys can be treated as schema described fields.
 *
 * Values with their own prototype, such as a `Buffer` or a database driver's id type, are opaque:
 * their keys are implementation detail rather than fields, and rebuilding them as plain objects
 * would destroy them. They are walked for private fields, as they always have been, but never
 * stripped down to a schema.
 *
 * @param value The value to inspect.
 * @returns True for plain objects.
 */
function isPlainObject(value: object): boolean {
    const prototype = Object.getPrototypeOf(value)

    return prototype === Object.prototype || prototype === null
}

/**
 * Finds the schema describing the items of an array.
 * @param schema The array's schema.
 * @param root The schema references are relative to.
 * @returns The item schema, or undefined if the schema does not describe items.
 */
function readItemSchema(schema: JSONSchema, root?: JSONSchema): JSONSchema | undefined {
    for (const applicable of collectApplicableSchemas(schema, root)) {
        // Tuple schemas provide an array of item schemas, which carry no single field shape.
        const items = Array.isArray(applicable.items) ? undefined : asSchemaObject(applicable.items)
        if (items) {
            return items
        }
    }

    return undefined
}

/**
 * Options controlling which fields are removed from a payload.
 */
export interface StripToSchemaOptions {
    /**
     * When true, fields marked `private: true` are kept. Defaults to false.
     */
    includePrivateFields?: boolean

    /**
     * When false, fields the schema does not describe are kept. Defaults to true.
     */
    stripUnknownFields?: boolean

    /**
     * The schema `$ref` pointers resolve against. Defaults to the schema being applied.
     */
    root?: JSONSchema
}

/**
 * The resolved settings a single walk of a payload runs with.
 */
interface IStripSettings {
    includePrivateFields: boolean
    stripUnknownFields: boolean
}

/**
 * Recursively reduces a payload to the fields its schema describes, removing both the fields
 * marked `private: true` and the fields the schema does not describe at all.
 *
 * This is what makes a payload safe to send without validating it first. Validation strips unknown
 * fields as a side effect of parsing, but it also throws on a payload a service legitimately built,
 * and it cannot run where serialization cannot await. Stripping is the part a boundary always
 * needs, so it is available on its own.
 *
 * A field is removed when the schema names none of the objects it could be. An object schema that
 * describes its properties and does not set `additionalProperties` is treated as closed, so a model
 * whose generator omits the keyword still strips. Set `additionalProperties` to `true` or to a
 * schema, as `z.looseObject` does, for a payload that carries fields the model does not name.
 *
 * The input is never modified. Objects and arrays that lose a field are rebuilt, and anything left
 * untouched is returned by reference so unaffected payloads are not copied.
 *
 * Nested objects, array items, `$ref` pointers and union branches are all walked.
 *
 * @param value The payload to strip.
 * @param schema The schema describing the payload. Must include private fields, so obtain it with
 * `toJSONSchema({ includePrivateFields: true })`.
 * @param options Settings controlling which fields are removed.
 * @returns The payload, reduced to the fields its schema describes.
 */
export function stripToSchema<T>(value: T, schema?: JSONSchema, options?: StripToSchemaOptions): T {
    if (!schema) {
        return value
    }

    const settings: IStripSettings = {
        includePrivateFields: options?.includePrivateFields ?? false,
        stripUnknownFields: options?.stripUnknownFields ?? true,
    }

    if (!settings.stripUnknownFields && settings.includePrivateFields) {
        return value
    }

    return stripValue(value, schema, options?.root ?? schema, 0, settings)
}

/**
 * Recursively removes values whose schema marks them `private: true`, leaving fields the schema
 * does not describe in place.
 *
 * Use `stripToSchema` to reduce a payload to the fields its schema describes.
 *
 * @param value The payload to strip.
 * @param schema The schema describing the payload. Must include private fields, so obtain it with
 * `toJSONSchema({ includePrivateFields: true })`.
 * @param root The schema `$ref` pointers resolve against. Defaults to `schema`.
 * @returns The payload without its private fields.
 */
export function stripPrivateValues<T>(value: T, schema?: JSONSchema, root?: JSONSchema): T {
    return stripToSchema(value, schema, { stripUnknownFields: false, root })
}

/**
 * Strips one level of a payload and recurses into its children.
 * @param value The value to strip.
 * @param schema The schema describing the value.
 * @param root The schema references resolve against.
 * @param depth The current recursion depth.
 * @param settings The settings controlling which fields are removed.
 * @returns The stripped value, or the original if nothing changed.
 */
function stripValue<T>(value: T, schema: JSONSchema, root: JSONSchema, depth: number, settings: IStripSettings): T {
    if (value === null || typeof value !== 'object' || depth >= MAX_SCHEMA_DEPTH) {
        return value
    }

    // Dates and other built-ins are values, not field containers.
    if (value instanceof Date) {
        return value
    }

    if (Array.isArray(value)) {
        const itemSchema = readItemSchema(schema, root)
        if (!itemSchema) {
            return value
        }

        let hasChanges = false
        const items = value.map((item) => {
            const stripped = stripValue(item, itemSchema, root, depth + 1, settings)
            hasChanges ||= stripped !== item
            return stripped
        })

        return (hasChanges ? items : value) as T
    }

    const fields = readSchemaFields(schema, root)
    const isStrippingUnknown = settings.stripUnknownFields && fields.isClosed && isPlainObject(value)

    let hasChanges = false
    const result: Record<string, unknown> = {}

    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        if (!settings.includePrivateFields && fields.privateKeys.has(key)) {
            hasChanges = true
            continue
        }

        let propertySchema = fields.propertySchemas.get(key)

        if (!fields.namedKeys.has(key)) {
            const unnamed = readUnnamedField(key, fields)

            if (isStrippingUnknown && !unnamed.isDescribed) {
                hasChanges = true
                continue
            }

            propertySchema = unnamed.schema
        }

        const stripped = propertySchema ? stripValue(child, propertySchema, root, depth + 1, settings) : child

        hasChanges ||= stripped !== child
        result[key] = stripped
    }

    return (hasChanges ? result : value) as T
}

/**
 * Recursively removes properties marked `private: true` from a JSON Schema, so the schema can be
 * published without revealing that the fields exist.
 *
 * The schema is modified in place and also returned.
 *
 * @param schema The schema to strip.
 * @returns The same schema, without its private properties.
 */
export function stripPrivateFieldsFromSchema(schema: JSONSchema): JSONSchema {
    stripSchema(schema, 0)
    return schema
}

/**
 * Strips one level of a schema and recurses into nested properties, array items, union branches
 * and `$defs`.
 * @param schema The schema to strip.
 * @param depth The current recursion depth.
 */
function stripSchema(schema: JSONSchema | undefined, depth: number): void {
    if (!schema || typeof schema !== 'object' || depth >= MAX_SCHEMA_DEPTH) {
        return
    }

    if (typeof schema.properties === 'object') {
        for (const key of Object.keys(schema.properties)) {
            const property = asSchemaObject(schema.properties[key])
            if (!property) {
                continue
            }

            if (property.private === true) {
                delete schema.properties[key]
            } else {
                stripSchema(property, depth + 1)
            }
        }
    }

    if (!Array.isArray(schema.items)) {
        stripSchema(asSchemaObject(schema.items), depth + 1)
    }

    for (const keyword of BRANCH_KEYWORDS) {
        const branches = schema[keyword]
        if (Array.isArray(branches)) {
            branches.forEach((branch) => stripSchema(asSchemaObject(branch), depth + 1))
        }
    }

    for (const definitions of [schema.$defs, schema.definitions]) {
        if (typeof definitions === 'object' && definitions !== null) {
            Object.values(definitions).forEach((definition) => stripSchema(asSchemaObject(definition), depth + 1))
        }
    }
}
