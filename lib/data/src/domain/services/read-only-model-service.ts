import type { AnyModelSchema, Model } from '@declaro/core'
import type {
    InferDetail,
    InferFilters,
    InferLookup,
    InferSearchResults,
    InferSort,
} from '../../shared/utils/schema-inference'
import { ModelQueryEvent } from '../events/event-types'
import { QueryEvent } from '../events/query-event'
import { BaseModelService, type IActionOptions } from './base-model-service'
import type { IPaginationInput } from '../models/pagination'

export interface ILoadOptions extends IActionOptions {}
export interface ISearchOptions<TSchema extends AnyModelSchema> extends IActionOptions {
    pagination?: IPaginationInput
    sort?: InferSort<TSchema>
}

export class ReadOnlyModelService<TSchema extends AnyModelSchema> extends BaseModelService<TSchema> {
    /**
     * Normalize the detail data to match the expected schema.
     * WARNING: This method is called once per detail in load operations.
     * Any intensive operations or queries should be avoided here, and done via bulk operations in the respective methods such as `loadMany` instead.
     * @param detail The detail data to normalize.
     * @returns The normalized detail data.
     */
    async normalizeDetail(detail: InferDetail<TSchema>): Promise<InferDetail<TSchema>> {
        return detail
    }

    /**
     * Normalize the summary data to match the expected schema.
     * WARNING: This method is called once per summary in search results, often in parallel.
     * Any intensive operations or queries should be avoided here, and done via bulk operations in the respective methods such as `search` instead.
     *
     * @param summary The summary data to normalize.
     * @returns The normalized summary data.
     */
    async normalizeSummary(summary: InferDetail<TSchema>): Promise<InferDetail<TSchema>> {
        return summary
    }

    /**
     * Load a single record by its lookup criteria.
     * @param lookup The lookup criteria to find the record.
     * @param options Additional options for the load operation.
     * @returns The loaded record details.
     */
    async load(lookup: InferLookup<TSchema>, options?: ILoadOptions): Promise<InferDetail<TSchema>> {
        // Emit the before load event
        const beforeLoadEvent = new QueryEvent<InferDetail<TSchema>, InferLookup<TSchema>>(
            this.getDescriptor(ModelQueryEvent.BeforeLoad, options?.scope),
            lookup,
        )
        await this.emitter.emitAsync(beforeLoadEvent)

        // Load the details from the repository
        const details = await this.repository.load(lookup)

        // Emit the after load event
        const afterLoadEvent = new QueryEvent<InferDetail<TSchema>, InferLookup<TSchema>>(
            this.getDescriptor(ModelQueryEvent.AfterLoad, options?.scope),
            lookup,
        ).setResult(details)
        await this.emitter.emitAsync(afterLoadEvent)

        return await this.normalizeDetail(details)
    }

    /**
     * Load multiple records by their lookup criteria.
     * @param lookups The lookup criteria to find the records.
     * @param options Additional options for the load operation.
     * @returns An array of loaded record details.
     */
    async loadMany(lookups: InferLookup<TSchema>[], options?: ILoadOptions): Promise<InferDetail<TSchema>[]> {
        // Emit the before load many event
        const beforeLoadManyEvent = new QueryEvent<InferDetail<TSchema>[], InferLookup<TSchema>[]>(
            this.getDescriptor(ModelQueryEvent.BeforeLoadMany, options?.scope),
            lookups,
        )
        await this.emitter.emitAsync(beforeLoadManyEvent)

        // Load the details from the repository
        const details = await this.repository.loadMany(lookups)

        // Emit the after load many event
        const afterLoadManyEvent = new QueryEvent<InferDetail<TSchema>[], InferLookup<TSchema>[]>(
            this.getDescriptor(ModelQueryEvent.AfterLoadMany, options?.scope),
            lookups,
        ).setResult(details)
        await this.emitter.emitAsync(afterLoadManyEvent)

        return await Promise.all(details.map((detail) => this.normalizeDetail(detail)))
    }

    /**
     * Search for records matching the given filters.
     * @param filters The filters to apply to the search.
     * @param options Additional options for the search operation.
     * @returns The search results.
     */
    async search(
        filters: InferFilters<TSchema>,
        options?: ISearchOptions<TSchema>,
    ): Promise<InferSearchResults<TSchema>> {
        // Emit the before search event
        const beforeSearchEvent = new QueryEvent<InferSearchResults<TSchema>, InferFilters<TSchema>>(
            this.getDescriptor(ModelQueryEvent.BeforeSearch, options?.scope),
            filters,
        )
        await this.emitter.emitAsync(beforeSearchEvent)

        // Search the repository with the provided filters
        const results = await this.repository.search(filters, options)

        // Emit the after search event
        const afterSearchEvent = new QueryEvent<InferSearchResults<TSchema>, InferFilters<TSchema>>(
            this.getDescriptor(ModelQueryEvent.AfterSearch, options?.scope),
            filters,
        ).setResult(results)
        await this.emitter.emitAsync(afterSearchEvent)

        // Return the search results
        return {
            ...results,
            results: await Promise.all(results.results.map((detail) => this.normalizeSummary(detail))),
        }
    }

    /**
     * Count the number of records matching the given filters.
     * @param filters The filters to apply to the count operation.
     * @returns The count of matching records.
     */
    async count(filters: InferFilters<TSchema>, options?: ISearchOptions<TSchema>): Promise<number> {
        // Emit the before count event
        const beforeCountEvent = new QueryEvent<number, InferFilters<TSchema>>(
            this.getDescriptor(ModelQueryEvent.BeforeCount, options?.scope),
            filters,
        )
        await this.emitter.emitAsync(beforeCountEvent)

        // Count the records in the repository
        const count = await this.repository.count(filters, options)

        // Emit the after count event
        const afterCountEvent = new QueryEvent<number, InferFilters<TSchema>>(
            this.getDescriptor(ModelQueryEvent.AfterCount, options?.scope),
            filters,
        ).setResult(count)
        await this.emitter.emitAsync(afterCountEvent)

        // Return the count
        return count
    }
}
