import type { AnyModelSchema, InferModelInput, InferModelOutput } from '@declaro/core'
import type { IPagination } from '../../domain/models/pagination'

export interface ISearchResults<T> {
    results: T[]
    pagination: IPagination
}

export type InferLookup<TSchema extends AnyModelSchema> = InferModelInput<TSchema['definition']['lookup']>
export type InferDetail<TSchema extends AnyModelSchema> = InferModelOutput<TSchema['definition']['detail']>
export type InferFilters<TSchema extends AnyModelSchema> = InferModelInput<TSchema['definition']['filters']>
export type InferSummary<TSchema extends AnyModelSchema> = InferModelOutput<TSchema['definition']['summary']>
export type InferInput<TSchema extends AnyModelSchema> = InferModelInput<TSchema['definition']['input']>
export type InferSearchResults<TSchema extends AnyModelSchema> = ISearchResults<InferSummary<TSchema>>
export type InferEntityMetadata<TSchema extends AnyModelSchema> = ReturnType<TSchema['getEntityMetadata']>
