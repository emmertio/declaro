import type { AuthValidator } from '@declaro/auth'
import type { AnyModelSchema } from '@declaro/core'
import type { ModelService } from '../domain/services/model-service'
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
}
