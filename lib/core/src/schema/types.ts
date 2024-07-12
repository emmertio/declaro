import type { OpenAPIV3_1 } from 'openapi-types'
/// @ts-ignore This import is optional - it should be defined by your project's build settings (@declaro/build).
import type { ModelNames } from '$models/reference'
import type { EntityLabels } from './labels'

export declare namespace DeclaroSchema {
    export type NonArraySchemaObjectType = OpenAPIV3_1.NonArraySchemaObjectType
    export type ArraySchemaObjectType = OpenAPIV3_1.ArraySchemaObjectType
    export type AnySchemaObjectType = NonArraySchemaObjectType | ArraySchemaObjectType

    export type AnyObjectProperties = {
        [name: string]: SchemaObject<any>
    }

    export interface BaseSchemaObject<T extends AnyObjectProperties> extends OpenAPIV3_1.BaseSchemaObject {
        $schema?: ModelNames
        propertyName?: string
        additionalProperties?: boolean | ReferenceObject | SchemaObject<T>
        properties?: T
        labels?: EntityLabels
        not?: ReferenceObject | SchemaObject<T>
        allOf?: (ReferenceObject | SchemaObject<T>)[]
        anyOf?: (ReferenceObject | SchemaObject<T>)[]
        oneOf?: (ReferenceObject | SchemaObject<T>)[]
    }

    export interface NonArraySchemaObject<T extends AnyObjectProperties> extends BaseSchemaObject<T> {
        type?: NonArraySchemaObjectType
        labels?: EntityLabels
    }

    export interface ArraySchemaObject<T extends AnyObjectProperties> extends BaseSchemaObject<T> {
        type: ArraySchemaObjectType
        items: ReferenceObject | SchemaObject<T>
    }

    // Open API supports mixed schema objects, but we strategically don't yet.
    // This is because mixed schema objects are hard to introspect and type correctly, and can usually be described in other ways.
    // interface MixedSchemaObject extends BaseSchemaObject {
    //     type?: (ArraySchemaObjectType | NonArraySchemaObjectType)[]
    //     items?: ReferenceObject | SchemaObject
    // }

    export type SchemaObject<T extends AnyObjectProperties, N extends string = string> =
        | ArraySchemaObject<T>
        | NonArraySchemaObject<T>

    export interface ReferenceObject {
        $ref: ModelNames
        format: string
    }
}
