import { getLabels, type ModelLabels } from './labels'
import { type InferModelInput } from './model'
import {
    buildMixin,
    defineMixin,
    type IAnyMixin,
    type IMixin,
    type IMixinHelper,
    type IMixinInput,
    type InferMixinInput,
} from './schema-mixin'

export type Subset<T> = {
    [K in keyof T]?: T[K]
}
export type Simplify<T> = { [K in keyof T]: T[K] } & {}

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

export type InferPKeyBaseType<T extends IAnyMixin> = T['lookup'] extends object
    ? keyof InferModelInput<T['lookup']> | undefined
    : undefined

export interface IModelEntityMetadata<T extends IAnyMixin> {
    primaryKey: InferPKeyBaseType<T>
}
export type AnyModelEntityMetadata = {
    primaryKey: string | number
}

export class ModelSchema<
    TName extends Readonly<string> = Readonly<string>,
    T extends IAnyMixin = IAnyMixin,
    TEntityMeta extends IModelEntityMetadata<T> | undefined = undefined,
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

    custom<IInput extends IMixinInput>(input: IInput): ModelSchema<TName, Simplify<T & IMixin<IInput>>> {
        const helpers = defaultMixin(this.helper)
        const definition = buildMixin(helpers, input)
        return new ModelSchema(this.name, {
            ...this.definition,
            ...definition,
        } as Simplify<T & IMixin<IInput>>)
    }

    read<TInput extends InferMixinInput<ReadMixin<TName>>>(
        input: TInput,
    ): ModelSchema<TName, Simplify<T & IMixin<TInput>>> {
        const helpers = readMixin(this.helper)
        const definition = buildMixin(helpers, input)

        return new ModelSchema(this.name, {
            ...this.definition,
            ...definition,
        } as Simplify<T & IMixin<TInput>>)
    }

    search<TInput extends InferMixinInput<SearchMixin<TName>>>(
        input: TInput,
    ): ModelSchema<TName, Simplify<T & IMixin<TInput>>> {
        const helpers = searchMixin(this.helper)
        const definition = buildMixin(helpers, input)

        return new ModelSchema(this.name, {
            ...this.definition,
            ...definition,
        } as Simplify<T & IMixin<TInput>>)
    }

    write<TInput extends InferMixinInput<WriteMixin<TName>>>(
        input: TInput,
    ): ModelSchema<TName, Simplify<T & IMixin<TInput>>> {
        const helpers = writeMixin(this.helper)
        const definition = buildMixin(helpers, input)

        return new ModelSchema(this.name, {
            ...this.definition,
            ...definition,
        } as Simplify<T & IMixin<TInput>>)
    }

    entity<TEntityMeta extends IModelEntityMetadata<T>>(meta: TEntityMeta) {
        return new ModelSchema<TName, T, TEntityMeta>(this.name, this.definition, meta)
    }

    getEntityMetadata(): TEntityMeta {
        return this.entityMetadata
    }
}

export type AnyModelSchema = ModelSchema<any, any, any>
