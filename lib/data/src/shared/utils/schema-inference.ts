import type { InferModelInput, InferModelOutput, ModelSchema } from '@declaro/core'
import type { IPagination } from '../../domain/models/pagination'

export interface ISearchResults<T> {
    results: T[]
    pagination: IPagination
}

export type InferLookup<TSchema extends ModelSchema<any, any>> = InferModelInput<TSchema['definition']['lookup']>
export type InferDetail<TSchema extends ModelSchema<any, any>> = InferModelOutput<TSchema['definition']['detail']>
export type InferFilters<TSchema extends ModelSchema<any, any>> = InferModelInput<TSchema['definition']['filters']>
export type InferSummary<TSchema extends ModelSchema<any, any>> = InferModelOutput<TSchema['definition']['summary']>
export type InferInput<TSchema extends ModelSchema<any, any>> = InferModelInput<TSchema['definition']['input']>
export type InferSearchResults<TSchema extends ModelSchema<any, any>> = ISearchResults<InferSummary<TSchema>>
