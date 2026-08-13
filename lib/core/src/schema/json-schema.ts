import { type JSONSchema7 } from 'json-schema'

/**
 * A nested schema position, which JSON Schema allows to be a boolean as well as a schema.
 */
export type JSONSchemaDefinition = JSONSchema | boolean

/**
 * Declaro's own field metadata, carried alongside the standard JSON Schema keywords.
 */
export interface JSONMeta {
    /**
     * Whether the field should be omitted from generated user interfaces. Hidden fields are still
     * sent and still validated.
     */
    hidden?: boolean

    /**
     * Whether the field is removed when a payload crosses a boundary. On a read model it is never
     * sent to a client; on an input model a client cannot write to it.
     */
    private?: boolean
}

/**
 * A JSON Schema carrying Declaro's own field metadata.
 *
 * The keywords that hold nested schemas are re-declared so that metadata such as `private` is
 * allowed everywhere it can appear, not only on a top level property.
 */
export interface JSONSchema
    extends Omit<
            JSONSchema7,
            | 'properties'
            | 'patternProperties'
            | 'additionalProperties'
            | 'items'
            | 'anyOf'
            | 'oneOf'
            | 'allOf'
            | 'definitions'
        >,
        JSONMeta {
    properties?:
        | {
              [key: string]: JSONSchemaDefinition
          }
        | undefined
    /**
     * Schemas for properties whose names match a regular expression.
     */
    patternProperties?:
        | {
              [key: string]: JSONSchemaDefinition
          }
        | undefined
    /**
     * Whether properties the schema does not name are allowed, and the schema they follow.
     *
     * `false` closes the object, so a payload crossing a boundary keeps only the named properties.
     */
    additionalProperties?: JSONSchemaDefinition | undefined
    items?: JSONSchemaDefinition | JSONSchemaDefinition[] | undefined
    anyOf?: JSONSchemaDefinition[] | undefined
    oneOf?: JSONSchemaDefinition[] | undefined
    allOf?: JSONSchemaDefinition[] | undefined
    /**
     * Reusable schemas, as emitted for a schema registered with an id.
     */
    $defs?:
        | {
              [key: string]: JSONSchemaDefinition
          }
        | undefined
    /**
     * Reusable schemas under the draft-07 keyword.
     */
    definitions?:
        | {
              [key: string]: JSONSchemaDefinition
          }
        | undefined
}
