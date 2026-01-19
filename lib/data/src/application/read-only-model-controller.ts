import type { AuthValidator } from '@declaro/auth'
import {} from '@declaro/auth'
import { PermissionValidator, type AnyModelSchema } from '@declaro/core'
import type { ILoadOptions, ISearchOptions, ReadOnlyModelService } from '../domain/services/read-only-model-service'
import type { InferDetail, InferFilters, InferLookup, InferSearchResults } from '../shared/utils/schema-inference'

export class ReadOnlyModelController<TSchema extends AnyModelSchema> {
    constructor(
        protected readonly service: ReadOnlyModelService<TSchema>,
        protected readonly authValidator: AuthValidator,
    ) {}

    async loadPermissions(lookup: InferLookup<TSchema>): Promise<PermissionValidator> {
        return PermissionValidator.create().someOf([
            this.service.getDescriptor('load', '*').toString(),
            this.service.getDescriptor('read', '*').toString(),
        ])
    }

    async load(lookup: InferLookup<TSchema>, options?: ILoadOptions): Promise<InferDetail<TSchema>> {
        const permissions = await this.loadPermissions(lookup)
        this.authValidator.validatePermissions((v) => v.extend(permissions))
        return this.service.load(lookup, options)
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
        return this.service.loadMany(lookups, options)
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
        return this.service.search(input, options)
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
