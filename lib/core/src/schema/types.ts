import type { OpenAPIV3_1 } from 'openapi-types'
/// @ts-ignore This import is optional - it should be defined by your project's build settings (@declaro/build).
import type { ModelNames } from '$models/reference'
import type { EntityLabels } from './labels'

export declare namespace DeclaroSchema {
    type Modify<T, R> = Omit<T, keyof R> & R

    export type NonArraySchemaObjectType = OpenAPIV3_1.NonArraySchemaObjectType
    export type ArraySchemaObjectType = OpenAPIV3_1.ArraySchemaObjectType
    export type AnySchemaObjectType = NonArraySchemaObjectType | ArraySchemaObjectType

    export type AnyObjectProperties = {
        [name: string]: SchemaObject<any> | ReferenceObject
    }

    export type AnyObjectParameters = {
        [name: string]: Omit<DeclaroSchema.ParameterObject, 'name'>
    }

    export interface BaseSchemaObject<T extends AnyObjectProperties, N extends ModelNames = ModelNames>
        extends OpenAPIV3_1.BaseSchemaObject {
        $schema?: N
        propertyName?: string
        additionalProperties?: boolean | ReferenceObject | SchemaObject<T>
        properties?: T
        labels?: EntityLabels
        not?: ReferenceObject | SchemaObject<T>
        allOf?: (ReferenceObject | SchemaObject<T>)[]
        anyOf?: (ReferenceObject | SchemaObject<T>)[]
        oneOf?: (ReferenceObject | SchemaObject<T>)[]
    }

    export interface NonArraySchemaObject<T extends AnyObjectProperties, N extends ModelNames>
        extends BaseSchemaObject<T, N> {
        type?: NonArraySchemaObjectType
        labels?: EntityLabels
    }

    export interface ArraySchemaObject<T extends AnyObjectProperties, N extends ModelNames>
        extends BaseSchemaObject<T> {
        type: ArraySchemaObjectType
        items: ReferenceObject | SchemaObject<T, N>
    }

    // Open API supports mixed schema objects, but we strategically don't yet.
    // This is because mixed schema objects are hard to introspect and type correctly, and can usually be described in other ways.
    // interface MixedSchemaObject extends BaseSchemaObject {
    //     type?: (ArraySchemaObjectType | NonArraySchemaObjectType)[]
    //     items?: ReferenceObject | SchemaObject
    // }

    export type SchemaObject<T extends AnyObjectProperties, N extends string = string> =
        | ArraySchemaObject<T, N>
        | NonArraySchemaObject<T, N>

    export type PropertyType<T extends SchemaObject<any>> = T['type'] extends 'string'
        ? string
        : T['type'] extends 'boolean'
        ? boolean
        : T['type'] extends 'number'
        ? number
        : T['type'] extends 'integer'
        ? number
        : T['type'] extends 'object'
        ? ObjectPayload<T['properties']>
        : T['type'] extends 'array'
        ? ObjectPayload<T['properties']>[]
        : any

    export type OperationInput<T extends AnyObjectParameters> = {
        [K in keyof T]: PropertyType<T[K]['schema']>
    }

    export type ObjectPayload<T extends AnyObjectProperties> = {
        [K in keyof T]: PropertyType<T[K]>
    }

    export type Payload<T extends AnyObjectProperties, TSchema extends SchemaObject<T>> = any

    export interface ReferenceObject {
        $ref: ModelNames
        format?: string
    }

    export type InfoObject = OpenAPIV3_1.InfoObject

    export type TagObject = OpenAPIV3_1.TagObject

    export type ExampleObject = OpenAPIV3_1.ExampleObject
    export type MediaTypeObject<T extends AnyObjectProperties> = Modify<
        OpenAPIV3_1.MediaTypeObject,
        {
            schema?: SchemaObject<T> | ReferenceObject
            examples?: Record<string, ReferenceObject | ExampleObject>
        }
    >
    export type ServerObject = OpenAPIV3_1.ServerObject
    export type LinkObject = Modify<
        OpenAPIV3_1.LinkObject,
        {
            server?: ServerObject
        }
    >

    export type ResponseObject = Modify<
        OpenAPIV3_1.ResponseObject,
        {
            headers?: {
                [header: string]: ReferenceObject | HeaderObject
            }
            content?: {
                [media: string]: MediaTypeObject<any>
            }
            links?: {
                [link: string]: ReferenceObject | LinkObject
            }
        }
    >
    export type ResponsesObject = OpenAPIV3_1.ResponsesObject

    export type HeaderObject = OpenAPIV3_1.HeaderObject
    export type HttpMethods = OpenAPIV3_1.HttpMethods

    // export type ParameterObject = OpenAPIV3_1.ParameterObject
    export type ParameterObject = Modify<
        OpenAPIV3_1.ParameterObject,
        {
            in: 'query' | 'header' | 'path' | 'cookie'
            schema?: SchemaObject<any> | ReferenceObject
        }
    >

    export type RequestBodyObject<T extends AnyObjectProperties> = Modify<
        OpenAPIV3_1.RequestBodyObject,
        {
            content: {
                [media: string]: MediaTypeObject<T>
            }
        }
    >
    export type CallbackObject = Record<string, PathItemObject | ReferenceObject>
    export type PathItemObject<T extends {} = {}> = Modify<
        OpenAPIV3_1.PathItemObject<T>,
        {
            servers?: ServerObject[]
            parameters?: (ReferenceObject | ParameterObject)[]
        }
    > & {
        [method in HttpMethods]?: OperationObject<T>
    }
    export type OperationObject<T extends {} = {}> = Modify<
        OpenAPIV3_1.OperationObject<T>,
        {
            parameters?: ParameterObject[]
            requestBody?: ReferenceObject | RequestBodyObject<T>
            responses?: ResponsesObject
            callbacks?: Record<string, ReferenceObject | CallbackObject>
            servers?: ServerObject[]
        }
    > &
        T
}
