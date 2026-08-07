import type { AuthValidator } from '@declaro/auth'
import {} from '@declaro/auth'
import {
    PermissionValidator,
    wrapModel,
    type AnyModelSchema,
    type IAnyModel,
    type WrapModelOptions,
} from '@declaro/core'
import type { ILoadOptions, ISearchOptions, ReadOnlyModelService } from '../domain/services/read-only-model-service'
import type {
    InferDetail,
    InferFilters,
    InferLookup,
    InferSearchResults,
    InferSummary,
} from '../shared/utils/schema-inference'

export class ReadOnlyModelController<TSchema extends AnyModelSchema> {
    constructor(
        protected readonly service: ReadOnlyModelService<TSchema>,
        protected readonly authValidator: AuthValidator,
    ) {}

    /**
     * The settings applied when this controller serializes a response.
     *
     * Override to change how responses serialize, for example to skip validation. Responses are
     * stripped of their private fields by default.
     *
     * @returns The wrap settings for this controller.
     */
    protected get wrapOptions(): WrapModelOptions {
        return {}
    }

    /**
     * The model describing a full record.
     */
    protected get detailModel(): IAnyModel | undefined {
        return this.service.getSchema()?.definition?.detail
    }

    /**
     * The model describing a record in a list.
     */
    protected get summaryModel(): IAnyModel | undefined {
        return this.service.getSchema()?.definition?.summary
    }

    /**
     * The model describing a writable payload.
     */
    protected get inputModel(): IAnyModel | undefined {
        return this.service.getSchema()?.definition?.input
    }

    /**
     * Serializes a detail record for the response.
     *
     * The service already wraps the records it returns, so this re-applies the wrapping in case a
     * custom service or normalize hook rebuilt the record and lost it. Override to add custom
     * serialization on top of private field stripping.
     *
     * @param value The record to serialize.
     * @returns The serialized record.
     */
    protected async serializeDetail(value: InferDetail<TSchema>): Promise<InferDetail<TSchema>> {
        if (!value || !this.detailModel) {
            return value
        }

        return wrapModel(this.detailModel, value, this.wrapOptions)
    }

    /**
     * Serializes a list of detail records for the response.
     * @param values The records to serialize.
     * @returns The serialized records.
     */
    protected async serializeDetails(values: InferDetail<TSchema>[]): Promise<InferDetail<TSchema>[]> {
        return Promise.all((values ?? []).map((value) => this.serializeDetail(value)))
    }

    /**
     * Serializes a summary record for the response.
     * @param value The record to serialize.
     * @returns The serialized record.
     */
    protected async serializeSummary(value: InferSummary<TSchema>): Promise<InferSummary<TSchema>> {
        if (!value || !this.summaryModel) {
            return value
        }

        return wrapModel(this.summaryModel, value, this.wrapOptions)
    }

    /**
     * Serializes a list of summary records for the response.
     * @param values The records to serialize.
     * @returns The serialized records.
     */
    protected async serializeSummaries(values: InferSummary<TSchema>[]): Promise<InferSummary<TSchema>[]> {
        return Promise.all((values ?? []).map((value) => this.serializeSummary(value)))
    }

    /**
     * Serializes a page of search results, leaving the pagination untouched.
     * @param results The search results to serialize.
     * @returns The serialized search results.
     */
    protected async serializeSearchResults(results: InferSearchResults<TSchema>): Promise<InferSearchResults<TSchema>> {
        if (!results) {
            return results
        }

        return {
            ...results,
            results: await this.serializeSummaries(results.results),
        }
    }

    async loadPermissions(lookup: InferLookup<TSchema>): Promise<PermissionValidator> {
        return PermissionValidator.create().someOf([
            this.service.getDescriptor('load', '*').toString(),
            this.service.getDescriptor('read', '*').toString(),
        ])
    }

    async load(lookup: InferLookup<TSchema>, options?: ILoadOptions): Promise<InferDetail<TSchema>> {
        const permissions = await this.loadPermissions(lookup)
        this.authValidator.validatePermissions((v) => v.extend(permissions))

        return this.serializeDetail(await this.service.load(lookup, options))
    }

    async loadManyPermissions(lookups: InferLookup<TSchema>[]): Promise<PermissionValidator> {
        return PermissionValidator.create().someOf([
            this.service.getDescriptor('loadMany', '*').toString(),
            this.service.getDescriptor('read', '*').toString(),
        ])
    }

    async loadMany(lookups: InferLookup<TSchema>[], options?: ILoadOptions): Promise<InferDetail<TSchema>[]> {
        const permissions = await this.loadManyPermissions(lookups)
        this.authValidator.validatePermissions((v) => v.extend(permissions))

        return this.serializeDetails(await this.service.loadMany(lookups, options))
    }

    async searchPermissions(
        input: InferFilters<TSchema>,
        options?: ISearchOptions<TSchema>,
    ): Promise<PermissionValidator> {
        return PermissionValidator.create().someOf([
            this.service.getDescriptor('search', '*').toString(),
            this.service.getDescriptor('read', '*').toString(),
        ])
    }

    async search(
        input: InferFilters<TSchema>,
        options?: ISearchOptions<TSchema>,
    ): Promise<InferSearchResults<TSchema>> {
        const permissions = await this.searchPermissions(input, options)
        this.authValidator.validatePermissions((v) => v.extend(permissions))

        return this.serializeSearchResults(await this.service.search(input, options))
    }

    async countPermissions(
        input: InferFilters<TSchema>,
        options?: ISearchOptions<TSchema>,
    ): Promise<PermissionValidator> {
        return PermissionValidator.create().someOf([
            this.service.getDescriptor('count', '*').toString(),
            this.service.getDescriptor('read', '*').toString(),
        ])
    }

    /**
     * Count the number of records matching the given filters.
     * @param input The filters to apply to the count operation.
     * @param options Additional options for the count operation.
     * @returns The count of matching records.
     */
    async count(input: InferFilters<TSchema>, options?: ISearchOptions<TSchema>): Promise<number> {
        const permissions = await this.countPermissions(input, options)
        this.authValidator.validatePermissions((v) => v.extend(permissions))
        return this.service.count(input, options)
    }
}
