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
export type InferSort<TSchema extends AnyModelSchema> = InferModelInput<TSchema['definition']['sort']>
export type InferInput<TSchema extends AnyModelSchema> = InferModelInput<TSchema['definition']['input']>
export type InferSearchResults<TSchema extends AnyModelSchema> = ISearchResults<InferSummary<TSchema>>
export type InferEntityMetadata<TSchema extends AnyModelSchema> = ReturnType<TSchema['getEntityMetadata']>
export type InferPrimaryKeyType<TSchema extends AnyModelSchema> =
    InferLookup<TSchema>[InferEntityMetadata<TSchema>['primaryKey']]

export type InferSummarySchema<TSchema extends AnyModelSchema> = TSchema['definition']['summary']['schema']
export type InferDetailSchema<TSchema extends AnyModelSchema> = TSchema['definition']['detail']['schema']
export type InferLookupSchema<TSchema extends AnyModelSchema> = TSchema['definition']['lookup']['schema']
export type InferInputSchema<TSchema extends AnyModelSchema> = TSchema['definition']['input']['schema']
export type InferFiltersSchema<TSchema extends AnyModelSchema> = TSchema['definition']['filters']['schema']
export type InferSortSchema<TSchema extends AnyModelSchema> = TSchema['definition']['sort']['schema']
export type InferSearchResultsSchema<TSchema extends AnyModelSchema> = TSchema['definition']['search']['schema']
