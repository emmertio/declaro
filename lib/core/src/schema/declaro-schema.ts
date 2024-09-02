// // @ts-ignore This import is optional - it should be defined by your project's build settings (@declaro/build).
// import type { EntityLabelMap, EntityLabels } from './labels'

// // export declare namespace DeclaroSchema {
// // export type Type = 'string' | 'number' | 'integer' | 'object' | 'array' | 'boolean' | 'null'

// // export type StringFormat =
// //     | 'short'
// //     | 'long'
// //     | 'email'
// //     | 'uri'
// //     | 'uuid'
// //     | 'date'
// //     | 'date-time'
// //     | 'time'
// //     | 'password'
// //     | 'html'
// //     | 'markdown'

// export type PropertyBaseInput<T> = {
//     // OAS Supported Keywords
//     title?: string
//     description?: string
//     type: string
//     format?: string
//     default?: T

//     // Extended Keywords
//     labels?: EntityLabelMap
//     nullable?: boolean
// }

// export type PropertyInput<T, E> = PropertyBaseInput<T> & E
// export type Property<T, E> = Required<PropertyBaseInput<T>> & E
