import type { AuthValidator } from '@declaro/auth'
import type { AnyModelSchema } from '@declaro/core'
import type { ModelService, ICreateOptions, IUpdateOptions } from '../domain/services/model-service'
import type { InferDetail, InferInput, InferLookup, InferSummary } from '../shared/utils/schema-inference'
import { ReadOnlyModelController } from './read-only-model-controller'

export class ModelController<TSchema extends AnyModelSchema> extends ReadOnlyModelController<TSchema> {
    constructor(protected readonly service: ModelService<TSchema>, protected readonly authValidator: AuthValidator) {
        super(service, authValidator)
    }

    async create(input: InferInput<TSchema>): Promise<InferDetail<TSchema>> {
        this.authValidator.validatePermissions((v) =>
            v.someOf([
                this.service.getDescriptor('create', '*').toString(),
                this.service.getDescriptor('write', '*').toString(),
            ]),
        )
        return this.service.create(input)
    }

    async update(lookup: InferLookup<TSchema>, input: InferInput<TSchema>): Promise<InferDetail<TSchema>> {
        this.authValidator.validatePermissions((v) =>
            v.someOf([
                this.service.getDescriptor('update', '*').toString(),
                this.service.getDescriptor('write', '*').toString(),
            ]),
        )
        return this.service.update(lookup, input)
    }

    async remove(lookup: InferLookup<TSchema>): Promise<InferSummary<TSchema>> {
        this.authValidator.validatePermissions((v) =>
            v.someOf([
                this.service.getDescriptor('remove', '*').toString(),
                this.service.getDescriptor('write', '*').toString(),
            ]),
        )
        return this.service.remove(lookup)
    }

    async restore(lookup: InferLookup<TSchema>): Promise<InferSummary<TSchema>> {
        this.authValidator.validatePermissions((v) =>
            v.someOf([
                this.service.getDescriptor('restore', '*').toString(),
                this.service.getDescriptor('write', '*').toString(),
            ]),
        )
        return this.service.restore(lookup)
    }

    /**
     * Upserts a record (creates if it doesn't exist, updates if it does).
     * @param input The input data for the upsert operation.
     * @param options Optional create or update options.
     * @returns The upserted record.
     */
    async upsert(input: InferInput<TSchema>, options?: ICreateOptions | IUpdateOptions): Promise<InferDetail<TSchema>> {
        this.authValidator.validatePermissions((v) =>
            v.someOf([
                v.allOf([
                    this.service.getDescriptor('create', '*').toString(),
                    this.service.getDescriptor('update', '*').toString(),
                ]),
                this.service.getDescriptor('write', '*').toString(),
            ]),
        )
        return this.service.upsert(input, options)
    }

    /**
     * Bulk upserts multiple records (creates if they don't exist, updates if they do).
     * @param inputs Array of input data for the bulk upsert operation.
     * @param options Optional create or update options.
     * @returns Array of upserted records.
     */
    async bulkUpsert(
        inputs: InferInput<TSchema>[],
        options?: ICreateOptions | IUpdateOptions,
    ): Promise<InferDetail<TSchema>[]> {
        this.authValidator.validatePermissions((v) =>
            v.someOf([
                v.allOf([
                    this.service.getDescriptor('create', '*').toString(),
                    this.service.getDescriptor('update', '*').toString(),
                ]),
                this.service.getDescriptor('write', '*').toString(),
            ]),
        )
        return this.service.bulkUpsert(inputs, options)
    }
}
