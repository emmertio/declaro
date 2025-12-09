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

    /**
     * Upserts an element based on the provided input.
     * If the element exists, it will be updated; otherwise, a new element will be created.
     *
     * A load operation will be performed to check if the element exists. create/update related events will be dispatched accordingly.
     *
     * @param input - The input data for the new or existing element.
     * @returns A promise resolving to the detailed created or updated element.
     */
    upsert(input: InferInput<TSchema>, options?: ICreateOptions | IUpdateOptions): Promise<InferDetail<TSchema>>

    /**
     * Upserts multiple elements based on the provided inputs.
     * If an element exists, it will be updated; otherwise, a new element will be created.
     *
     * A loadMany operation will be performed to check if the elements exist. create/update related events will be dispatched accordingly.
     *
     * @param inputs - The input data for the upsert operation.
     * @returns A promise resolving to an array of detailed upserted elements.
     */
    bulkUpsert(
        inputs: InferInput<TSchema>[],
        options?: ICreateOptions | IUpdateOptions,
    ): Promise<InferDetail<TSchema>[]>

    /**
     * Counts the number of elements matching the provided search criteria.
     *
     * @param search - The search criteria to apply.
     * @returns A promise resolving to the count of matching elements.
     */
    count(search: InferFilters<TSchema>, options?: ISearchOptions<TSchema>): Promise<number>

    /**
     * Permanently deletes all items from trash, optionally filtered by the provided criteria.
     * Items deleted via this method cannot be restored.
     *
     * @param filters - Optional filters to apply when selecting items to delete from trash.
     * @returns A promise resolving to the count of permanently deleted items.
     */
    emptyTrash(filters?: InferFilters<TSchema>): Promise<number>

    /**
     * Permanently deletes a specific item from trash based on the provided lookup.
     * The item must exist in trash (previously removed). Items deleted via this method cannot be restored.
     *
     * @param lookup - The lookup criteria for the item to permanently delete from trash.
     * @returns A promise resolving to the permanently deleted item summary.
     * @throws Error if the item is not found in trash.
     */
    permanentlyDeleteFromTrash(lookup: InferLookup<TSchema>): Promise<InferSummary<TSchema>>

    /**
     * Permanently deletes an item based on the provided lookup, regardless of whether it is active or in trash.
     * Items deleted via this method cannot be restored.
     *
     * @param lookup - The lookup criteria for the item to permanently delete.
     * @returns A promise resolving to the permanently deleted item summary.
     * @throws Error if the item is not found in either active data or trash.
     */
    permanentlyDelete(lookup: InferLookup<TSchema>): Promise<InferSummary<TSchema>>
}
