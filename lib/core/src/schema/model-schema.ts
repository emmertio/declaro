import { merge } from '../dataflow'
import type { Merge, ShallowMerge } from '../typescript'
import { getLabels, type ModelLabels } from './labels'
import { type InferModelInput } from './model'
import {
    buildMixin,
    defineMixin,
    type IAnyMixin,
    type IMixin,
    type IMixinHelper,
    type IMixinHelpers,
    type IMixinInput,
    type InferMixinInput,
} from './schema-mixin'
import { MockModel } from './test/mock-model'
import { z } from 'zod/v4'

export type Subset<T> = {
    [K in keyof T]?: T[K]
}
export type Simplify<T> = { [K in keyof T]: T[K] } & {}

export type MergeMixins<TA extends IAnyMixin | undefined, TB extends IAnyMixin> = Simplify<
    TA extends IAnyMixin ? ShallowMerge<TA, TB> : TB
>

export function getReadHelpers<TName extends Readonly<string>>(h: IMixinHelper<TName>) {
    return {
        detail: { name: h.name },
        lookup: { name: `${h.name}Lookup` as const },
    }
}

const readMixin = defineMixin((h) => ({
    detail: {
        name: `${h.name}Detail` as const,
    },
    lookup: {
        name: `${h.name}Lookup` as const,
    },
}))
export type ReadMixin<TName extends Readonly<string>> = ReturnType<typeof readMixin<TName>>

const defaultMixin = defineMixin((h) => ({}))
export type DefaultMixin<TName extends Readonly<string>> = ReturnType<typeof defaultMixin<TName>>

const searchMixin = defineMixin((h) => ({
    summary: { name: `${h.name}Summary` as const },
    filters: { name: `${h.name}Filters` as const },
    sort: { name: `${h.name}Sort` as const },
}))
export type SearchMixin<TName extends Readonly<string>> = ReturnType<typeof searchMixin<TName>>

const writeMixin = defineMixin((h) => ({
    input: { name: `${h.name}Input` as const },
}))
export type WriteMixin<TName extends Readonly<string>> = ReturnType<typeof writeMixin<TName>>

export type IModelNames<T extends object> = {
    [K in keyof T]: Readonly<string>
}

export type InferPKeyBaseType<T extends IAnyMixin | undefined> = T extends IAnyMixin
    ? T['lookup'] extends object
        ? keyof InferModelInput<T['lookup']> | undefined
        : undefined
    : undefined

export interface IModelEntityMetadata {
    primaryKey: string
}

export class ModelSchema<
    TName extends Readonly<string> = Readonly<string>,
    T extends IAnyMixin | undefined = undefined,
    TEntityMeta extends IModelEntityMetadata | undefined = undefined,
> {
    static create<TName extends Readonly<string>>(name: TName): ModelSchema<TName> {
        return new ModelSchema(name)
    }

    public readonly definition: Simplify<T>
    public readonly name: TName
    protected readonly entityMetadata: TEntityMeta

    constructor(name: TName, definition: T = {} as T, entityMetadata?: TEntityMeta) {
        this.definition = definition
        this.name = name
        this.entityMetadata = entityMetadata!
    }

    get labels(): ModelLabels {
        return getLabels(this.name)
    }

    get helper(): IMixinHelper<TName> {
        return {
            name: this.name,
        }
    }

    custom<TInput extends IMixinInput>(input: TInput): ModelSchema<TName, MergeMixins<T, IMixin<TInput>>, TEntityMeta> {
        const helpers: IMixinHelpers<TInput> = Object.keys(input).reduce((acc: any, key) => {
            const helper = this.helper
            acc[key] = helper
            return acc
        }, {} as IMixinHelpers<TInput>)
        const definition = buildMixin(helpers, input as any)

        return new ModelSchema(
            this.name,
            {
                ...this.definition,
                ...definition,
            },
            this.entityMetadata,
        ) as any
    }

    read<TInput extends InferMixinInput<ReadMixin<TName>>>(
        input: TInput,
    ): ModelSchema<TName, MergeMixins<T, IMixin<TInput>>, TEntityMeta> {
        const helpers = readMixin(this.helper)
        const definition = buildMixin(helpers, input)

        return new ModelSchema(
            this.name,
            {
                ...this.definition,
                ...definition,
            },
            this.entityMetadata,
        ) as any
    }

    search<TInput extends InferMixinInput<SearchMixin<TName>>>(
        input: TInput,
    ): ModelSchema<TName, MergeMixins<T, IMixin<TInput>>> {
        const helpers = searchMixin(this.helper)
        const definition = buildMixin(helpers, input)

        return new ModelSchema(
            this.name,
            {
                ...this.definition,
                ...definition,
            },
            this.entityMetadata,
        ) as any
    }

    write<TInput extends InferMixinInput<WriteMixin<TName>>>(
        input: TInput,
    ): ModelSchema<TName, MergeMixins<T, IMixin<TInput>>> {
        const helpers = writeMixin(this.helper)
        const definition = buildMixin(helpers, input)

        return new ModelSchema(
            this.name,
            {
                ...this.definition,
                ...definition,
            },
            this.entityMetadata,
        ) as any
    }

    entity<
        TEntityMeta extends {
            primaryKey: InferPKeyBaseType<T>
        },
    >(meta: TEntityMeta): ModelSchema<TName, T, TEntityMeta extends IModelEntityMetadata ? TEntityMeta : undefined> {
        const lookupMeta = this.definition?.['lookup']?.toJSONSchema()
        const lookupKeys = Object.keys(lookupMeta?.properties ?? {})

        const metaIsValid = meta && typeof meta.primaryKey === 'string' && lookupKeys.includes(meta.primaryKey)
        return new ModelSchema<TName, T, TEntityMeta extends IModelEntityMetadata ? TEntityMeta : undefined>(
            this.name,
            this.definition,
            metaIsValid ? (meta as any) : undefined,
        )
    }

    getEntityMetadata(): TEntityMeta {
        return this.entityMetadata
    }
}

export type AnyModelSchema = ModelSchema<any, any, any>

const test = ModelSchema.create('Test').read({
    detail: (h) => new MockModel(h.name, z.object({ id: z.string(), name: z.string() })),
    lookup: (h) => new MockModel(h.name, z.object({ id: z.string(), name: z.string() })),
})

const d = test.definition
const l = {} as any as keyof InferModelInput<typeof test.definition.lookup>
