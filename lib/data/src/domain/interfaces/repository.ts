import type { AnyModelSchema } from '@declaro/core'
import type {
    InferDetail,
    InferFilters,
    InferInput,
    InferLookup,
    InferSearchResults,
    InferSummary,
} from '../../shared/utils/schema-inference'
import type { ICreateOptions, IUpdateOptions } from '../services/model-service'
import type { ILoadOptions, ISearchOptions } from '../services/read-only-model-service'

export interface IRepository<TSchema extends AnyModelSchema> {
    /**
     * Loads a single element based on the provided lookup.
     *
     * @param input - The lookup criteria for the element.
     * @returns A promise resolving to the detailed element or null if not found.
     */
    load(input: InferLookup<TSchema>, options?: ILoadOptions): Promise<InferDetail<TSchema> | null>

    /**
     * Loads multiple elements based on the provided lookups.
     *
     * @param inputs - The lookup criteria for the elements.
     * @returns A promise resolving to an array of detailed elements.
     */
    loadMany(inputs: InferLookup<TSchema>[], options?: ILoadOptions): Promise<InferDetail<TSchema>[]>

    /**
     * Searches for elements based on filters and optional pagination.
     *
     * @param input - The filters to apply to the search.
     * @param pagination - Optional pagination criteria.
     * @returns A promise resolving to the search results.
     */
    search(input: InferFilters<TSchema>, options?: ISearchOptions<TSchema>): Promise<InferSearchResults<TSchema>>

    /**
     * Deletes elements based on the provided lookups.
     *
     * @param lookup - The lookup criteria for the element to delete.
     * @returns A promise resolving to the deleted list item.
     */
    remove(lookup: InferLookup<TSchema>, options?: ILoadOptions): Promise<InferSummary<TSchema>>

    /**
     * Restores an element based on the provided lookups, if a soft-deleted copy exists.
     *
     * @param lookup - The lookup criteria for the element to restore.
     * @returns A promise resolving to the restored list item.
     */
    restore(lookup: InferLookup<TSchema>, options?: ILoadOptions): Promise<InferSummary<TSchema>>

    /**
     * Creates a new element based on the provided input.
     *
     * @param input - The input data for the new element.
     * @returns A promise resolving to the detailed created element.
     */
    create(input: InferInput<TSchema>, options?: ICreateOptions): Promise<InferDetail<TSchema>>

    /**
     * Updates elements based on filters.
     *
     * @param filters - The filters to apply to the update.
     * @returns A promise resolving to the detailed updated element.
     */
    update(
        lookup: InferLookup<TSchema>,
        input: InferInput<TSchema>,
        options?: IUpdateOptions,
    ): Promise<InferDetail<TSchema>>
}
