import { getLabels, type ModelLabels } from './labels'
import type { InferModelOutput, ModelFactory } from './model'
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

export interface IReadModelDefinition<TName extends Readonly<string>> extends IMixinInput {
    detail: ModelFactory<TName>
    lookup: ModelFactory<`${TName}Lookup`>
}

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

const searchMixin = defineMixin((h) => ({
    listItem: { name: `${h.name}ListItem` as const },
    filters: { name: `${h.name}Filters` as const },
}))
export type SearchMixin<TName extends Readonly<string>> = ReturnType<typeof searchMixin<TName>>

const writeMixin = defineMixin((h) => ({
    input: { name: `${h.name}Input` as const },
}))
export type WriteMixin<TName extends Readonly<string>> = ReturnType<typeof writeMixin<TName>>

export type InferModelDetailValue<T extends IReadModelDefinition<any>> = InferModelOutput<ReturnType<T['detail']>>

export type InferModelLookupValue<T extends IReadModelDefinition<any>> = InferModelOutput<ReturnType<T['lookup']>>

export type IModelNames<T extends object> = {
    [K in keyof T]: Readonly<string>
}

export class ModelSchema<TName extends Readonly<string>, T extends IAnyMixin = {}> {
    static create<TName extends Readonly<string>>(name: TName): ModelSchema<TName> {
        return new ModelSchema(name)
    }

    public readonly definition: Simplify<T>
    public readonly name: TName

    constructor(name: TName, definition: T = {} as T) {
        this.definition = definition
        this.name = name
    }

    get labels(): ModelLabels {
        return getLabels(this.name)
    }

    get helper(): IMixinHelper<TName> {
        return {
            name: this.name,
        }
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
}
