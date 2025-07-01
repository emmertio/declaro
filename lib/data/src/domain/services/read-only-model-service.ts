import type { ModelSchema } from '@declaro/core'
import type { InferDetail, InferFilters, InferLookup, InferSearchResults } from '../../shared/utils/schema-inference'
import { BaseModelService, type IActionOptions } from './base-model-service'
import { QueryEvent } from '../events/query-event'
import { ModelQueryEvent } from '../events/event-types'

export interface ILoadOptions extends IActionOptions {}
export interface ISearchOptions extends IActionOptions {}

export class ReadOnlyModelService<TSchema extends ModelSchema<any, any>> extends BaseModelService<TSchema> {
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

        return details
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

        return details
    }

    /**
     * Search for records matching the given filters.
     * @param filters The filters to apply to the search.
     * @param options Additional options for the search operation.
     * @returns The search results.
     */
    async search(filters: InferFilters<TSchema>, options?: ISearchOptions): Promise<InferSearchResults<TSchema>> {
        // Emit the before search event
        const beforeSearchEvent = new QueryEvent<InferSearchResults<TSchema>, InferFilters<TSchema>>(
            this.getDescriptor(ModelQueryEvent.BeforeSearch, options?.scope),
            filters,
        )
        await this.emitter.emitAsync(beforeSearchEvent)

        // Search the repository with the provided filters
        const results = await this.repository.search(filters)

        // Emit the after search event
        const afterSearchEvent = new QueryEvent<InferSearchResults<TSchema>, InferFilters<TSchema>>(
            this.getDescriptor(ModelQueryEvent.AfterSearch, options?.scope),
            filters,
        ).setResult(results)
        await this.emitter.emitAsync(afterSearchEvent)

        // Return the search results
        return results
    }
}
