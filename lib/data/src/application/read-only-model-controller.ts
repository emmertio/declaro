import type { AuthValidator } from '@declaro/auth'
import {} from '@declaro/auth'
import type { AnyModelSchema } from '@declaro/core'
import type { ILoadOptions, ISearchOptions, ReadOnlyModelService } from '../domain/services/read-only-model-service'
import type { InferDetail, InferFilters, InferLookup, InferSearchResults } from '../shared/utils/schema-inference'

export class ReadOnlyModelController<TSchema extends AnyModelSchema> {
    constructor(
        protected readonly service: ReadOnlyModelService<TSchema>,
        protected readonly authValidator: AuthValidator,
    ) {}

    async load(lookup: InferLookup<TSchema>, options?: ILoadOptions): Promise<InferDetail<TSchema>> {
        this.authValidator.validatePermissions((v) =>
            v.someOf([
                this.service.getDescriptor('load', '*').toString(),
                this.service.getDescriptor('read', '*').toString(),
            ]),
        )
        return this.service.load(lookup, options)
    }

    async loadMany(lookups: InferLookup<TSchema>[], options?: ILoadOptions): Promise<InferDetail<TSchema>[]> {
        this.authValidator.validatePermissions((v) =>
            v.someOf([
                this.service.getDescriptor('loadMany', '*').toString(),
                this.service.getDescriptor('read', '*').toString(),
            ]),
        )
        return this.service.loadMany(lookups, options)
    }

    async search(
        input: InferFilters<TSchema>,
        options?: ISearchOptions<TSchema>,
    ): Promise<InferSearchResults<TSchema>> {
        this.authValidator.validatePermissions((v) =>
            v.someOf([
                this.service.getDescriptor('search', '*').toString(),
                this.service.getDescriptor('read', '*').toString(),
            ]),
        )
        return this.service.search(input, options)
    }
}
