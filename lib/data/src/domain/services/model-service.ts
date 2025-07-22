import type { AnyModelSchema } from '@declaro/core'
import type { InferDetail, InferInput, InferLookup, InferSummary } from '../../shared/utils/schema-inference'
import { ModelMutationAction, ModelQueryEvent } from '../events/event-types'
import { MutationEvent } from '../events/mutation-event'
import type { IModelServiceArgs } from './model-service-args'
import { ReadOnlyModelService, type ILoadOptions } from './read-only-model-service'
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
    async remove(lookup: InferLookup<TSchema>, options?: ILoadOptions): Promise<InferSummary<TSchema>> {
        // Emit the before remove event
        const beforeRemoveEvent = new MutationEvent<InferSummary<TSchema>, InferLookup<TSchema>>(
            this.getDescriptor(ModelMutationAction.BeforeRemove),
            lookup,
        )
        await this.emitter.emitAsync(beforeRemoveEvent)

        // Perform the removal
        const result = await this.repository.remove(lookup, options)

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
    async restore(lookup: InferLookup<TSchema>, options?: ILoadOptions): Promise<InferSummary<TSchema>> {
        // Emit the before restore event
        const beforeRestoreEvent = new MutationEvent<InferSummary<TSchema>, InferLookup<TSchema>>(
            this.getDescriptor(ModelMutationAction.BeforeRestore),
            lookup,
        )
        await this.emitter.emitAsync(beforeRestoreEvent)

        // Perform the restore operation
        const result = await this.repository.restore(lookup, options)

        // Emit the after restore event
        const afterRestoreEvent = new MutationEvent<InferSummary<TSchema>, InferLookup<TSchema>>(
            this.getDescriptor(ModelMutationAction.AfterRestore),
            lookup,
        ).setResult(result)
        await this.emitter.emitAsync(afterRestoreEvent)

        // Return the results of the restore operation
        return result
    }

    async create(input: InferInput<TSchema>, options?: ICreateOptions): Promise<InferDetail<TSchema>> {
        // Emit the before create event
        const beforeCreateEvent = new MutationEvent<InferDetail<TSchema>, InferInput<TSchema>>(
            this.getDescriptor(ModelMutationAction.BeforeCreate),
            input,
        )
        await this.emitter.emitAsync(beforeCreateEvent)

        // Perform the creation
        const result = await this.repository.create(input, options)

        // Emit the after create event
        const afterCreateEvent = new MutationEvent<InferDetail<TSchema>, InferInput<TSchema>>(
            this.getDescriptor(ModelMutationAction.AfterCreate),
            input,
        ).setResult(result)
        await this.emitter.emitAsync(afterCreateEvent)

        // Return the results of the creation
        return result
    }

    async update(
        lookup: InferLookup<TSchema>,
        input: InferInput<TSchema>,
        options?: IUpdateOptions,
    ): Promise<InferDetail<TSchema>> {
        // Emit the before update event
        const beforeUpdateEvent = new MutationEvent<InferDetail<TSchema>, InferInput<TSchema>>(
            this.getDescriptor(ModelMutationAction.BeforeUpdate),
            input,
        )
        await this.emitter.emitAsync(beforeUpdateEvent)

        // Perform the update
        const result = await this.repository.update(lookup, input, options)

        // Emit the after update event
        const afterUpdateEvent = new MutationEvent<InferDetail<TSchema>, InferInput<TSchema>>(
            this.getDescriptor(ModelMutationAction.AfterUpdate),
            input,
        ).setResult(result)
        await this.emitter.emitAsync(afterUpdateEvent)

        // Return the results of the update
        return result
    }

    /**
     * Upserts a record (creates if it doesn't exist, updates if it does).
     * @param input The input data for the upsert operation.
     * @param options Optional create or update options.
     * @returns The upserted record.
     */
    async upsert(input: InferInput<TSchema>, options?: ICreateOptions | IUpdateOptions): Promise<InferDetail<TSchema>> {
        const primaryKeyValue = this.getPrimaryKeyValue(input)

        let beforeOperation: ModelMutationAction
        let afterOperation: ModelMutationAction

        if (primaryKeyValue === undefined) {
            beforeOperation = ModelMutationAction.BeforeCreate
            afterOperation = ModelMutationAction.AfterCreate
        } else {
            const existingItem = await this.load(
                {
                    [this.entityMetadata.primaryKey]: primaryKeyValue,
                } as InferLookup<TSchema>,
                options,
            )

            if (existingItem) {
                beforeOperation = ModelMutationAction.BeforeUpdate
                afterOperation = ModelMutationAction.AfterUpdate
            } else {
                beforeOperation = ModelMutationAction.BeforeCreate
                afterOperation = ModelMutationAction.AfterCreate
            }
        }

        // Emit the before upsert event
        const beforeUpsertEvent = new MutationEvent<InferDetail<TSchema>, InferInput<TSchema>>(
            this.getDescriptor(beforeOperation),
            input,
        )
        await this.emitter.emitAsync(beforeUpsertEvent)

        // Perform the upsert operation
        const result = await this.repository.upsert(input, options)

        // Emit the after upsert event
        const afterUpsertEvent = new MutationEvent<InferDetail<TSchema>, InferInput<TSchema>>(
            this.getDescriptor(afterOperation),
            input,
        ).setResult(result)
        await this.emitter.emitAsync(afterUpsertEvent)

        // Return the results of the upsert operation
        return result
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
        if (inputs.length === 0) {
            return []
        }

        // Build a map of primary key to input and lookup info
        type EntityInfo = {
            input: InferInput<TSchema>
            lookup: InferLookup<TSchema>
            primaryKeyValue: string | number
            existingEntity?: InferDetail<TSchema>
            operation?: ModelMutationAction
        }

        const entityInfoMap = new Map<string | number, EntityInfo>()
        const inputsWithoutPrimaryKey: InferInput<TSchema>[] = []

        // Process each input and organize by primary key
        for (const input of inputs) {
            const primaryKeyValue = this.getPrimaryKeyValue(input)

            if (primaryKeyValue !== undefined) {
                const entityInfo: EntityInfo = {
                    input,
                    primaryKeyValue,
                    lookup: {
                        [this.entityMetadata.primaryKey]: primaryKeyValue,
                    } as InferLookup<TSchema>,
                }
                entityInfoMap.set(primaryKeyValue, entityInfo)
            } else {
                // Inputs without primary keys are always creates
                inputsWithoutPrimaryKey.push(input)
            }
        }

        // Extract lookups for existing entities
        const lookups = Array.from(entityInfoMap.values()).map((info) => info.lookup)

        // Load existing entities and update the map
        if (lookups.length > 0) {
            const existingEntities = await this.loadMany(lookups, options)
            existingEntities.forEach((entity) => {
                if (entity) {
                    const pkValue = this.getPrimaryKeyValue(entity)
                    if (pkValue !== undefined && entityInfoMap.has(pkValue)) {
                        const entityInfo = entityInfoMap.get(pkValue)!
                        entityInfo.existingEntity = entity
                    }
                }
            })
        }

        // Determine operation types and prepare before events
        const beforeEvents: MutationEvent<InferDetail<TSchema>, InferInput<TSchema>>[] = []

        // Handle entities with primary keys
        for (const entityInfo of entityInfoMap.values()) {
            const operation = entityInfo.existingEntity
                ? ModelMutationAction.BeforeUpdate
                : ModelMutationAction.BeforeCreate

            entityInfo.operation = operation

            beforeEvents.push(
                new MutationEvent<InferDetail<TSchema>, InferInput<TSchema>>(
                    this.getDescriptor(operation),
                    entityInfo.input,
                ),
            )
        }

        // Handle inputs without primary keys (always creates)
        for (const input of inputsWithoutPrimaryKey) {
            beforeEvents.push(
                new MutationEvent<InferDetail<TSchema>, InferInput<TSchema>>(
                    this.getDescriptor(ModelMutationAction.BeforeCreate),
                    input,
                ),
            )
        }

        // Emit all before events
        await Promise.all(beforeEvents.map((event) => this.emitter.emitAsync(event)))

        // Perform the bulk upsert operation
        const results = await this.repository.bulkUpsert(inputs, options)

        // Create a map of result primary keys to results for matching
        const resultsByPrimaryKey = new Map<string | number, InferDetail<TSchema>>()
        const resultsWithoutPrimaryKey: InferDetail<TSchema>[] = []

        for (const result of results) {
            const pkValue = this.getPrimaryKeyValue(result)
            if (pkValue !== undefined) {
                resultsByPrimaryKey.set(pkValue, result)
            } else {
                resultsWithoutPrimaryKey.push(result)
            }
        }

        // Prepare after events by matching results back to original inputs
        const afterEvents: MutationEvent<InferDetail<TSchema>, InferInput<TSchema>>[] = []
        let resultsWithoutPkIndex = 0

        // Handle entities with primary keys
        for (const entityInfo of entityInfoMap.values()) {
            const matchedResult = resultsByPrimaryKey.get(entityInfo.primaryKeyValue)!

            const afterOperation =
                entityInfo.operation === ModelMutationAction.BeforeCreate
                    ? ModelMutationAction.AfterCreate
                    : ModelMutationAction.AfterUpdate

            afterEvents.push(
                new MutationEvent<InferDetail<TSchema>, InferInput<TSchema>>(
                    this.getDescriptor(afterOperation),
                    entityInfo.input,
                ).setResult(matchedResult),
            )
        }

        // Handle inputs without primary keys (always creates)
        for (const input of inputsWithoutPrimaryKey) {
            const matchedResult = resultsWithoutPrimaryKey[resultsWithoutPkIndex++]

            afterEvents.push(
                new MutationEvent<InferDetail<TSchema>, InferInput<TSchema>>(
                    this.getDescriptor(ModelMutationAction.AfterCreate),
                    input,
                ).setResult(matchedResult),
            )
        }

        // Emit all after events
        await Promise.all(afterEvents.map((event) => this.emitter.emitAsync(event)))

        // Return the results
        return results
    }
}
