import type { AnyModelSchema } from '@declaro/core'
import type { InferDetail, InferInput, InferLookup, InferSummary } from '../../shared/utils/schema-inference'
import { ModelMutationAction } from '../events/event-types'
import { MutationEvent } from '../events/mutation-event'
import type { IModelServiceArgs } from './model-service-args'
import { ReadOnlyModelService } from './read-only-model-service'
import type { IActionOptions } from './base-model-service'

export interface ICreateOptions extends IActionOptions {}
export interface IUpdateOptions extends IActionOptions {}

export class ModelService<TSchema extends AnyModelSchema> extends ReadOnlyModelService<TSchema> {
    constructor(args: IModelServiceArgs<TSchema>) {
        super(args)
    }

    /**
     * Removes a record by its lookup criteria.
     * @param lookup The lookup criteria to find the record.
     * @returns The removed record.
     */
    async remove(lookup: InferLookup<TSchema>): Promise<InferSummary<TSchema>> {
        // Emit the before remove event
        const beforeRemoveEvent = new MutationEvent<InferSummary<TSchema>, InferLookup<TSchema>>(
            this.getDescriptor(ModelMutationAction.BeforeRemove),
            lookup,
        )
        await this.emitter.emitAsync(beforeRemoveEvent)

        // Perform the removal
        const result = await this.repository.remove(lookup)

        // Emit the after remove event
        const afterRemoveEvent = new MutationEvent<InferSummary<TSchema>, InferLookup<TSchema>>(
            this.getDescriptor(ModelMutationAction.AfterRemove),
            lookup,
        ).setResult(result)
        await this.emitter.emitAsync(afterRemoveEvent)

        // Return the results of the removal
        return result
    }

    /**
     * Restores a record by its lookup criteria.
     * If a soft-deleted copy exists, it will be restored.
     * @param lookup The lookup criteria to find the record to restore.
     * @returns
     */
    async restore(lookup: InferLookup<TSchema>): Promise<InferSummary<TSchema>> {
        // Emit the before restore event
        const beforeRestoreEvent = new MutationEvent<InferSummary<TSchema>, InferLookup<TSchema>>(
            this.getDescriptor(ModelMutationAction.BeforeRestore),
            lookup,
        )
        await this.emitter.emitAsync(beforeRestoreEvent)

        // Perform the restore operation
        const result = await this.repository.restore(lookup)

        // Emit the after restore event
        const afterRestoreEvent = new MutationEvent<InferSummary<TSchema>, InferLookup<TSchema>>(
            this.getDescriptor(ModelMutationAction.AfterRestore),
            lookup,
        ).setResult(result)
        await this.emitter.emitAsync(afterRestoreEvent)

        // Return the results of the restore operation
        return result
    }

    async create(input: InferInput<TSchema>): Promise<InferDetail<TSchema>> {
        // Emit the before create event
        const beforeCreateEvent = new MutationEvent<InferDetail<TSchema>, InferInput<TSchema>>(
            this.getDescriptor(ModelMutationAction.BeforeCreate),
            input,
        )
        await this.emitter.emitAsync(beforeCreateEvent)

        // Perform the creation
        const result = await this.repository.create(input)

        // Emit the after create event
        const afterCreateEvent = new MutationEvent<InferDetail<TSchema>, InferInput<TSchema>>(
            this.getDescriptor(ModelMutationAction.AfterCreate),
            input,
        ).setResult(result)
        await this.emitter.emitAsync(afterCreateEvent)

        // Return the results of the creation
        return result
    }

    async update(lookup: InferLookup<TSchema>, input: InferInput<TSchema>): Promise<InferDetail<TSchema>> {
        // Emit the before update event
        const beforeUpdateEvent = new MutationEvent<InferDetail<TSchema>, InferInput<TSchema>>(
            this.getDescriptor(ModelMutationAction.BeforeUpdate),
            input,
        )
        await this.emitter.emitAsync(beforeUpdateEvent)

        // Perform the update
        const result = await this.repository.update(lookup, input)

        // Emit the after update event
        const afterUpdateEvent = new MutationEvent<InferDetail<TSchema>, InferInput<TSchema>>(
            this.getDescriptor(ModelMutationAction.AfterUpdate),
            input,
        ).setResult(result)
        await this.emitter.emitAsync(afterUpdateEvent)

        // Return the results of the update
        return result
    }
}
