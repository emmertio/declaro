import type { EntityLabelMap } from '../labels'

export type PropertyBaseInput<T> = {
    // OAS Supported Keywords
    title?: string
    description?: string
    type: string
    format?: string
    default?: T

    // Extended Keywords
    labels?: EntityLabelMap
    nullable?: boolean
}

export type PropertyInput<T, E> = PropertyBaseInput<T> & E
export type Property<T, E> = Required<PropertyBaseInput<T>> & E

// export type AttributeFn<T, M> = (
//     meta: AttributeMetadata,
//     context: Context,
// ) => Attribute<T, M> | Promise<Attribute<T, M>>

export type PropertyMetadata = {
    name: string
}

export type PropertyFn<T, E> = (meta: PropertyMetadata) => Property<T, E> | Promise<Property<T, E>>
