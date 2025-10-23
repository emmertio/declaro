import { type JSONSchema7 } from 'json-schema'

export type JSONSchemaDefinition = JSONSchema | boolean

export interface JSONMeta {}

export interface JSONSchema extends JSONSchema7, JSONMeta {
    properties?:
        | {
              [key: string]: JSONSchemaDefinition
          }
        | undefined
}
