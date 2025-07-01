import { type IAnyModel, type ModelFactory } from './model'

export interface IAnyMixin {
    [key: string]: IAnyModel
}

export type IMixin<TInput extends IMixinInput> = {
    [K in keyof TInput]: TInput[K] extends ModelFactory<any> ? ReturnType<TInput[K]> : never
}

export interface IMixinInput {
    [key: string]: ModelFactory<any>
}

export interface IMixinHelper<TName extends Readonly<string>> {
    name: TName
}

export type IMixinHelpers<TMixin extends IMixinInput> = {
    [K in keyof TMixin]: TMixin[K] extends ModelFactory<infer TName> ? IMixinHelper<TName> : never
}

export function buildMixin<TMixin extends IMixinHelpers<any>>(
    helpers: TMixin,
    input: InferMixinInput<TMixin>,
): IMixin<InferMixinInput<TMixin>> {
    const mixin: IAnyMixin = {}
    for (const key in helpers) {
        const helper = helpers[key]
        if (typeof helper?.name === 'string') {
            mixin[key] = input[key](helper)
        } else {
            throw new Error(`Invalid helper name for key "${key}": ${helper.name}`)
        }
    }
    return mixin as IMixin<InferMixinInput<TMixin>>
}

export type MixinFn<THelpers extends IMixinHelpers<any>> = <TName extends Readonly<string>>(
    helper: IMixinHelper<TName>,
) => THelpers

export function defineMixin<TInput extends IMixinHelpers<any>, Fn extends MixinFn<TInput>>(fn: Fn) {
    return fn
}

export type InferMixinInput<T extends IMixinHelpers<any>> = {
    [K in keyof T]: T[K] extends IMixinHelper<infer TName> ? ModelFactory<TName> : never
}

export type InferMixinSchema<TMixin extends IMixinHelpers<any>> = IMixin<InferMixinInput<TMixin>>
