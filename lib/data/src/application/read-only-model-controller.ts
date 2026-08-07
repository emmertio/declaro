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

/**
 * Exposes a read only service over a permission checked boundary.
 *
 * The `serialize*` methods do not produce a string. They attach a `toJSON` implementation to the
 * record, so that whatever eventually serializes it removes the fields marked `private: true`.
 * Nothing is removed until that happens, which for an HTTP handler is the framework calling
 * `JSON.stringify` on whatever the route returned.
 */
export class ReadOnlyModelController<TSchema extends AnyModelSchema> {
    constructor(
        protected readonly service: ReadOnlyModelService<TSchema>,
        protected readonly authValidator: AuthValidator,
    ) {}

    /**
     * The settings attached to a response, controlling how it will serialize.
     *
     * Override to change that behaviour, for example to skip validation. Private fields are
     * removed by default.
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
     * Prepares a detail record for the response.
     *
     * This does not serialize the record. It attaches a `toJSON` implementation, so the private
     * fields are removed later, when the record is actually serialized:
     *
     * ```ts
     * const user = await controller.load({ id: 1 })
     *
     * user.passwordHash                      // still readable here
     * JSON.stringify(user)                   // '{"id":1,"name":"Ada"}'
     * ```
     *
     * Most HTTP frameworks serialize the value a route returns, so a handler does not need to do
     * anything further. A handler that reshapes the record by hand, or a transport that does not
     * use `JSON.stringify`, will not get this treatment.
     *
     * The service already prepares the records it returns. This applies it again in case a custom
     * service or normalize hook rebuilt the record and dropped it. Override to add custom
     * behaviour on top of private field removal.
     *
     * @param value The record to prepare.
     * @returns The record, ready to serialize.
     */
    protected async serializeDetail(value: InferDetail<TSchema>): Promise<InferDetail<TSchema>> {
        if (!value || !this.detailModel) {
            return value
        }

        return wrapModel(this.detailModel, value, this.wrapOptions)
    }

    /**
     * Prepares a list of detail records for the response.
     * @param values The records to prepare.
     * @returns The records, ready to serialize.
     */
    protected async serializeDetails(values: InferDetail<TSchema>[]): Promise<InferDetail<TSchema>[]> {
        return Promise.all((values ?? []).map((value) => this.serializeDetail(value)))
    }

    /**
     * Prepares a summary record for the response, using the summary model rather than the detail
     * model. See `serializeDetail` for when the private fields are actually removed.
     * @param value The record to prepare.
     * @returns The record, ready to serialize.
     */
    protected async serializeSummary(value: InferSummary<TSchema>): Promise<InferSummary<TSchema>> {
        if (!value || !this.summaryModel) {
            return value
        }

        return wrapModel(this.summaryModel, value, this.wrapOptions)
    }

    /**
     * Prepares a list of summary records for the response.
     * @param values The records to prepare.
     * @returns The records, ready to serialize.
     */
    protected async serializeSummaries(values: InferSummary<TSchema>[]): Promise<InferSummary<TSchema>[]> {
        return Promise.all((values ?? []).map((value) => this.serializeSummary(value)))
    }

    /**
     * Prepares a page of search results, leaving the pagination untouched.
     * @param results The search results to prepare.
     * @returns The search results, ready to serialize.
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
