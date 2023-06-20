import { EntityLabels, setLabels } from '../utils/labels'
import { capitalCase, pascalCase } from 'change-case'
import { Scalar } from '../utils/data-types'
import { PropertyMap, Collection, CollectionRef } from './collection'
import { Context } from '../../context'

export type SourceArgs = {
    name: string
    title: string
    labels: EntityLabels
    nullable: boolean
}

export type SourceFormatFn = (args: SourceArgs) => string

export type AttributeBaseInput<T> = {
    name?: string
    title?: string
    description?: string
    type: string
    labels?: EntityLabels
    format?: string
    nullable?: boolean
    graphql: string
    typescript: string
    classProperty: SourceFormatFn
    default?: T | undefined
}

export type AttributeInput<T, M> = AttributeBaseInput<T> & M

export type Attribute<T, M> = Required<AttributeBaseInput<T>> & M
export type ExtractAttributeType<T> = T extends Attribute<infer AT, infer AM>
    ? AT
    : never
export type ExtractAttributeMeta<T> = T extends Attribute<infer AT, infer AM>
    ? AM
    : never
export type AttributeFromInput<I extends AttributeInput<any, any>> = Attribute<
    ExtractAttributeType<I>,
    ExtractAttributeMeta<I>
>

export function defineAttribute<T, M>(
    config: AttributeInput<T, M>,
): Attribute<T, M> {
    return {
        ...config,
        name: config.name ?? 'unknown',
        title: config.title ?? capitalCase(config.name ?? 'unknown'),
        description: config.description ?? '',
        type: config.type ?? 'unknown',
        labels: setLabels(config.name ?? 'unknown', config.labels),
        format: config.format ?? 'standard',
        default: config.default as T,
        nullable: config.nullable ?? true,
        typescript: config.typescript,
        graphql: config.graphql,
        classProperty: config.classProperty,
    }
}

export type AttributeMetadata = {
    name: string
}

export type AttributeFactory<A extends any[], T, M> = (
    ...args: A
) => AttributeFn<T, M>

export type AttributeFn<T, M> = (
    meta: AttributeMetadata,
    context: Context,
) => Attribute<T, M> | Promise<Attribute<T, M>>

export function defineAttributeType<A extends any[], T, M>(
    factory: AttributeFactory<A, T, M>,
): AttributeFactory<A, T, M> {
    return factory
}

export function createClassProperty(args: SourceArgs, type: string) {
    return `${args.name}${args.nullable ? '?:' : ':'} ${type}`
}

export type TypeArgs<T> = {
    nullable?: boolean
    default?: T
    format?: string
    title?: string
    description?: string
}

export type StringTypeArgs = TypeArgs<string> & {}

export enum StringFormat {
    TEXT_SHORT = 'text-short',
    TEXT_LONG = 'text-long',
    TEXT_HTML = 'text-html',
}

export const string = defineAttributeType((args?: TypeArgs<string>) => {
    return async (meta) => {
        const attr = defineAttribute({
            type: Scalar.String,
            ...args,
            name: meta.name,
            classProperty: (args) => createClassProperty(args, 'string'),
            format: args?.format ?? 'text-short',
            graphql: 'String',
            typescript: 'string',
        })

        return attr
    }
})

export type NumberTypeArgs = TypeArgs<number> & {}

export enum NumberFormat {
    INT = 'int',
    FLOAT = 'float',
}

export const number = defineAttributeType((args?: TypeArgs<number>) => {
    return async (meta) => {
        const attr = defineAttribute({
            type: Scalar.Number,
            ...args,
            name: meta.name,
            classProperty: (args) => createClassProperty(args, 'number'),
            format: args?.format ?? NumberFormat.FLOAT,
            graphql: args?.format === NumberFormat.INT ? 'Int' : 'Float',
            typescript: 'number',
        })

        return attr
    }
})

export const boolean = defineAttributeType((args?: TypeArgs<boolean>) => {
    return async (meta) => {
        const attr = defineAttribute({
            type: Scalar.Boolean,
            ...args,
            name: meta.name,
            classProperty: (args) => createClassProperty(args, 'boolean'),
            format: args?.format ?? 'boolean',
            graphql: 'Boolean',
            typescript: 'boolean',
        })

        return attr
    }
})

export type Class<T> = new (...args: any[]) => T

export type RelationTypeArgs<T, M extends CollectionRef<any>> = TypeArgs<T> & {
    model: M
}
export type RelationTypeMeta<T, M extends Collection<any>> = TypeArgs<T> & {
    model: M
}

export enum RelationFormat {
    ManyToMany = 'many-to-many',
    ManyToOne = 'many-to-one',
    OneToMany = 'one-to-many',
    OneToOne = 'one-to-one',
}

// TODO: Make relation collections subqueryable in GraphQL
export const relation = defineAttributeType(
    <T, A extends PropertyMap>(args: RelationTypeArgs<T, CollectionRef<A>>) => {
        return async (meta, context) => {
            const { model, ...attrArgs } = args
            const loadedModel = await model.load(context)
            return defineAttribute<any, RelationTypeMeta<any, Collection<A>>>({
                type: Scalar.Relation,
                ...attrArgs,
                name: meta.name,
                classProperty: (args) =>
                    createClassProperty(args, pascalCase(args.name)),
                format: args.format ?? RelationFormat.ManyToMany,
                graphql:
                    args?.format === RelationFormat.ManyToMany ||
                    args.format === RelationFormat.OneToMany
                        ? `[${model.name ?? 'JSON'}]`
                        : model.name ?? 'JSON',
                typescript:
                    args?.format === RelationFormat.ManyToMany ||
                    args.format === RelationFormat.OneToMany
                        ? `${model.name ?? 'any'}[]`
                        : model.name ?? 'any',
                model: loadedModel,
            })
        }
    },
)

export type EmbeddedTypeArgs<T, M extends CollectionRef<any>> = TypeArgs<T> & {
    model: M
    format?: EmbeddedType
}

export type EmbeddedTypeMeta<T, M extends Collection<any>> = TypeArgs<T> & {
    model: M
}

export enum EmbeddedType {
    One = 'one',
    Many = 'many',
}

export const embedded = defineAttributeType(
    <T, A extends PropertyMap>(args: EmbeddedTypeArgs<T, CollectionRef<A>>) => {
        return async (meta, context) => {
            const { model, ...attrArgs } = args
            const loadedModel = await model.load(context)
            const labels = setLabels(model.name)
            const format = args.format ?? EmbeddedType.One

            return defineAttribute<any, EmbeddedTypeMeta<any, Collection<A>>>({
                type: Scalar.Embedded,
                ...attrArgs,
                name: meta.name,
                classProperty: (args) =>
                    createClassProperty(
                        args,
                        pascalCase(args.name) +
                            (format === EmbeddedType.Many ? '[]' : ''),
                    ),
                format,
                graphql:
                    format === EmbeddedType.One
                        ? labels.singularEntityName ?? 'JSON'
                        : `[${labels.singularEntityName ?? 'JSON'}]`,
                typescript:
                    format === EmbeddedType.One
                        ? labels.singularEntityName ?? 'any'
                        : `${labels.singularEntityName ?? 'any'}[]`,
                model: loadedModel,
            })
        }
    },
)

export type DateType = 'date' | 'time' | 'datetime'

export type DateTypeArgs = TypeArgs<Date> & {
    format?: DateType
}

export const date = defineAttributeType((args?: TypeArgs<Date>) => {
    return async (meta) => {
        const attr = defineAttribute({
            type: Scalar.Date,
            ...args,
            name: meta.name,
            classProperty: (args) => createClassProperty(args, 'Date'),
            format: args?.format ?? 'date',
            graphql: 'DateTime',
            typescript: 'Date',
        })

        return attr
    }
})

export const json = defineAttributeType((args?: TypeArgs<any>) => {
    return async (meta) => {
        const attr = defineAttribute({
            type: Scalar.JSON,
            ...args,
            name: meta.name,
            classProperty: (args) => createClassProperty(args, 'any'),
            format: args?.format ?? 'json',
            graphql: 'JSON',
            typescript: 'any',
        })

        return attr
    }
})

export const t = {
    string,
    number,
    boolean,
    relation,
    embedded,
    date,
    json,
}
