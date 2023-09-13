import type { OpenAPIV3_1 } from 'openapi-types'
/// @ts-ignore This import is optional - it should be defined by your project's build settings (@declaro/build).
import type { ModelNames } from '$models/reference'

export declare namespace DeclaroSchema {
    export type NonArraySchemaObjectType = OpenAPIV3_1.NonArraySchemaObjectType
    export type ArraySchemaObjectType = OpenAPIV3_1.ArraySchemaObjectType

    export interface BaseSchemaObject extends OpenAPIV3_1.BaseSchemaObject {
        $schema?: ModelNames
        additionalProperties?: boolean | ReferenceObject | SchemaObject
        properties?: {
            [name: string]: ReferenceObject | SchemaObject
        }
        not?: ReferenceObject | SchemaObject
        allOf?: (ReferenceObject | SchemaObject)[]
        anyOf?: (ReferenceObject | SchemaObject)[]
        oneOf?: (ReferenceObject | SchemaObject)[]
    }

    export interface NonArraySchemaObject extends BaseSchemaObject {
        type?: NonArraySchemaObjectType
    }

    export interface ArraySchemaObject extends BaseSchemaObject {
        type: ArraySchemaObjectType
        items: ReferenceObject | SchemaObject
    }

    // Open API supports mixed schema objects, but we strategically don't yet.
    // This is because mixed schema objects are hard to introspect and type correctly, and can usually be described in other ways.
    // interface MixedSchemaObject extends BaseSchemaObject {
    //     type?: (ArraySchemaObjectType | NonArraySchemaObjectType)[]
    //     items?: ReferenceObject | SchemaObject
    // }

    export type SchemaObject = ArraySchemaObject | NonArraySchemaObject

    export interface ReferenceObject {
        $ref: ModelNames
        format: string
    }
}
