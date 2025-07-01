import type { ModelSchema } from '@declaro/core'
import { ReadOnlyModelController } from './read-only-model-controller'
import type { ModelService } from '../domain/services/model-service'
import type { AuthValidator } from '@declaro/auth'
import type { InferInput, InferDetail, InferLookup, InferSummary } from '../shared/utils/schema-inference'

export class ModelController<TSchema extends ModelSchema> extends ReadOnlyModelController<TSchema> {
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
