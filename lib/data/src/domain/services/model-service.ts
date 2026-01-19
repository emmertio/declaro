import type { ActionDescriptor, AnyModelSchema, IActionDescriptor } from '@declaro/core'
import type {
    InferDetail,
    InferFilters,
    InferInput,
    InferLookup,
    InferSummary,
} from '../../shared/utils/schema-inference'
import { ModelMutationAction, ModelQueryEvent } from '../events/event-types'
import { MutationEvent } from '../events/mutation-event'
import type { IModelServiceArgs } from './model-service-args'
import { ReadOnlyModelService, type ILoadOptions } from './read-only-model-service'
import type { IActionOptions } from './base-model-service'

export interface ICreateOptions extends IActionOptions {
    /**
     * If true, skips dispatching events for this action.
     */
    doNotDispatchEvents?: boolean
}
export interface IUpdateOptions extends IActionOptions {
    /**
     * If true, skips dispatching events for this action.
     */
    doNotDispatchEvents?: boolean
}

export interface INormalizeInputArgs<TSchema extends AnyModelSchema> {
    existing?: InferDetail<TSchema>
    descriptor: ActionDescriptor
}

export class ModelService<TSchema extends AnyModelSchema> extends ReadOnlyModelService<TSchema> {
    constructor(args: IModelServiceArgs<TSchema>) {
        super(args)
    }

    /**
     * Normalizes input data before processing. This method can be overridden by subclasses
     * to implement custom input normalization logic (e.g., trimming strings, setting defaults, etc.).
     * By default, this method returns the input unchanged.
     * @param input The input data to normalize.
     * @returns The normalized input data.
     */
    protected async normalizeInput(
        input: InferInput<TSchema>,
        args: INormalizeInputArgs<TSchema>,
    ): Promise<InferInput<TSchema>> {
        return input
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
        return await this.normalizeSummary(result)
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
        return await this.normalizeSummary(result)
    }

    async create(input: InferInput<TSchema>, options?: ICreateOptions): Promise<InferDetail<TSchema>> {
        // Normalize the input data
        const normalizedInput = await this.normalizeInput(input, {
            descriptor: this.getDescriptor(ModelMutationAction.Create),
        })

        // Emit the before create event
        if (!options?.doNotDispatchEvents) {
            const beforeCreateEvent = new MutationEvent<InferDetail<TSchema>, InferInput<TSchema>>(
                this.getDescriptor(ModelMutationAction.BeforeCreate),
                normalizedInput,
            )
            await this.emitter.emitAsync(beforeCreateEvent)
        }

        // Perform the creation
        const result = await this.repository.create(normalizedInput, options)

        // Emit the after create event
        if (!options?.doNotDispatchEvents) {
            const afterCreateEvent = new MutationEvent<InferDetail<TSchema>, InferInput<TSchema>>(
                this.getDescriptor(ModelMutationAction.AfterCreate),
                normalizedInput,
            ).setResult(result)
            await this.emitter.emitAsync(afterCreateEvent)
        }

        // Return the results of the creation
        return await this.normalizeDetail(result)
    }

    async update(
        lookup: InferLookup<TSchema>,
        input: InferInput<TSchema>,
        options?: IUpdateOptions,
    ): Promise<InferDetail<TSchema>> {
        const existing = await this.repository.load(lookup, { ...options, doNotDispatchEvents: true })
        // Normalize the input data
        const normalizedInput = await this.normalizeInput(input, {
            existing,
            descriptor: this.getDescriptor(ModelMutationAction.Update),
        })

        // Emit the before update event
        if (!options?.doNotDispatchEvents) {
            const beforeUpdateEvent = new MutationEvent<InferDetail<TSchema>, InferInput<TSchema>>(
                this.getDescriptor(ModelMutationAction.BeforeUpdate),
                normalizedInput,
            )
            await this.emitter.emitAsync(beforeUpdateEvent)
        }

        // Perform the update
        const result = await this.repository.update(lookup, normalizedInput, options)

        // Emit the after update event
        if (!options?.doNotDispatchEvents) {
            const afterUpdateEvent = new MutationEvent<InferDetail<TSchema>, InferInput<TSchema>>(
                this.getDescriptor(ModelMutationAction.AfterUpdate),
                normalizedInput,
            ).setResult(result)
            await this.emitter.emitAsync(afterUpdateEvent)
        }

        // Return the results of the update
        return await this.normalizeDetail(result)
    }

    /**
     * Upserts a record (creates if it doesn't exist, updates if it does).
     * @param input The input data for the upsert operation.
     * @param options Optional create or update options.
     * @returns The upserted record.
     */
    async upsert(input: InferInput<TSchema>, options?: ICreateOptions | IUpdateOptions): Promise<InferDetail<TSchema>> {
        const primaryKeyValue = this.getPrimaryKeyValue(input)

        let operation: ModelMutationAction
        let beforeOperation: ModelMutationAction
        let afterOperation: ModelMutationAction
        let existingItem: InferDetail<TSchema> | undefined = undefined

        if (primaryKeyValue === undefined) {
            operation = ModelMutationAction.Create
            beforeOperation = ModelMutationAction.BeforeCreate
            afterOperation = ModelMutationAction.AfterCreate
        } else {
            existingItem = await this.load(
                {
                    [this.entityMetadata.primaryKey]: primaryKeyValue,
                } as InferLookup<TSchema>,
                {
                    ...options,
                    doNotDispatchEvents: true,
                },
            )

            if (existingItem) {
                operation = ModelMutationAction.Update
                beforeOperation = ModelMutationAction.BeforeUpdate
                afterOperation = ModelMutationAction.AfterUpdate
            } else {
                operation = ModelMutationAction.Create
                beforeOperation = ModelMutationAction.BeforeCreate
                afterOperation = ModelMutationAction.AfterCreate
            }
        }

        // Normalize the input data
        const normalizedInput = await this.normalizeInput(input, {
            descriptor: this.getDescriptor(operation),
            existing: existingItem,
        })

        // Emit the before upsert event
        if (!options?.doNotDispatchEvents) {
            const beforeUpsertEvent = new MutationEvent<InferDetail<TSchema>, InferInput<TSchema>>(
                this.getDescriptor(beforeOperation),
                normalizedInput,
            )
            await this.emitter.emitAsync(beforeUpsertEvent)
        }

        // Perform the upsert operation
        const result = await this.repository.upsert(normalizedInput, options)

        // Emit the after upsert event
        if (!options?.doNotDispatchEvents) {
            const afterUpsertEvent = new MutationEvent<InferDetail<TSchema>, InferInput<TSchema>>(
                this.getDescriptor(afterOperation),
                normalizedInput,
            ).setResult(result)
            await this.emitter.emitAsync(afterUpsertEvent)
        }

        // Return the results of the upsert operation
        return await this.normalizeDetail(result)
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

        // Keep track of input metadata for each position (preserves order and duplicates)
        type InputInfo = {
            input: InferInput<TSchema>
            index: number
            primaryKeyValue?: string | number
            existingEntity?: InferDetail<TSchema>
            operation?: ModelMutationAction
        }

        const inputInfos: InputInfo[] = []
        const uniqueLookups = new Map<string | number, InferLookup<TSchema>>()

        // Process each input and collect unique lookups
        for (let i = 0; i < inputs.length; i++) {
            const input = inputs[i]
            const primaryKeyValue = this.getPrimaryKeyValue(input)

            const inputInfo: InputInfo = {
                input,
                index: i,
                primaryKeyValue,
            }
            inputInfos.push(inputInfo)

            // Collect unique lookups for entities that have primary keys
            if (primaryKeyValue !== undefined) {
                uniqueLookups.set(primaryKeyValue, {
                    [this.entityMetadata.primaryKey]: primaryKeyValue,
                } as InferLookup<TSchema>)
            }
        }

        // Load existing entities for unique primary keys
        const existingEntitiesMap = new Map<string | number, InferDetail<TSchema>>()
        if (uniqueLookups.size > 0) {
            const lookups = Array.from(uniqueLookups.values())
            const existingEntities = await this.loadMany(lookups, {
                ...options,
                doNotDispatchEvents: true,
            })
            existingEntities.forEach((entity) => {
                if (entity) {
                    const pkValue = this.getPrimaryKeyValue(entity)
                    if (pkValue !== undefined) {
                        existingEntitiesMap.set(pkValue, entity)
                    }
                }
            })
        }

        // Normalize all inputs and determine operations in parallel
        const normalizationPromises = inputInfos.map(async (inputInfo) => {
            // Set existing entity if found
            if (inputInfo.primaryKeyValue !== undefined) {
                inputInfo.existingEntity = existingEntitiesMap.get(inputInfo.primaryKeyValue)
            }

            // Determine operation type
            inputInfo.operation = inputInfo.existingEntity
                ? ModelMutationAction.BeforeUpdate
                : ModelMutationAction.BeforeCreate

            // Normalize the input
            const normalizedInput = await this.normalizeInput(inputInfo.input, {
                existing: inputInfo.existingEntity,
                descriptor: this.getDescriptor(
                    inputInfo.existingEntity ? ModelMutationAction.Update : ModelMutationAction.Create,
                ),
            })

            inputInfo.input = normalizedInput
            return normalizedInput
        })

        const normalizedInputs = await Promise.all(normalizationPromises)

        // Create before events
        if (!options?.doNotDispatchEvents) {
            const beforeEvents: MutationEvent<InferDetail<TSchema>, InferInput<TSchema>>[] = []
            for (const inputInfo of inputInfos) {
                beforeEvents.push(
                    new MutationEvent<InferDetail<TSchema>, InferInput<TSchema>>(
                        this.getDescriptor(inputInfo.operation!),
                        inputInfo.input,
                    ),
                )
            }

            // Emit all before events
            await Promise.all(beforeEvents.map((event) => this.emitter.emitAsync(event)))
        }

        // Perform the bulk upsert operation with all normalized inputs
        const results = await this.repository.bulkUpsert(normalizedInputs, options)

        // Create after events and return results
        if (!options?.doNotDispatchEvents) {
            const afterEvents: MutationEvent<InferDetail<TSchema>, InferInput<TSchema>>[] = []

            for (let i = 0; i < inputInfos.length; i++) {
                const inputInfo = inputInfos[i]
                const result = results[i]

                const afterOperation =
                    inputInfo.operation === ModelMutationAction.BeforeCreate
                        ? ModelMutationAction.AfterCreate
                        : ModelMutationAction.AfterUpdate

                afterEvents.push(
                    new MutationEvent<InferDetail<TSchema>, InferInput<TSchema>>(
                        this.getDescriptor(afterOperation),
                        inputInfo.input,
                    ).setResult(result),
                )
            }

            // Emit all after events
            await Promise.all(afterEvents.map((event) => this.emitter.emitAsync(event)))
        }

        // Return normalized results
        return await Promise.all(results.map((result) => this.normalizeDetail(result)))
    }

    /**
     * Permanently deletes all items from trash, optionally filtered by the provided criteria.
     * @param filters Optional filters to apply when selecting items to delete from trash.
     * @returns The count of permanently deleted items.
     */
    async emptyTrash(filters?: InferFilters<TSchema>): Promise<number> {
        // Emit the before empty trash event
        const beforeEmptyTrashEvent = new MutationEvent<number, InferFilters<TSchema> | undefined>(
            this.getDescriptor(ModelMutationAction.BeforeEmptyTrash),
            filters,
        )
        await this.emitter.emitAsync(beforeEmptyTrashEvent)

        // Perform the empty trash operation
        const count = await this.repository.emptyTrash(filters)

        // Emit the after empty trash event
        const afterEmptyTrashEvent = new MutationEvent<number, InferFilters<TSchema> | undefined>(
            this.getDescriptor(ModelMutationAction.AfterEmptyTrash),
            filters,
        ).setResult(count)
        await this.emitter.emitAsync(afterEmptyTrashEvent)

        // Return the count of deleted items
        return count
    }

    /**
     * Permanently deletes a specific item from trash based on the provided lookup.
     * @param lookup The lookup criteria for the item to permanently delete from trash.
     * @returns The permanently deleted item summary.
     */
    async permanentlyDeleteFromTrash(lookup: InferLookup<TSchema>): Promise<InferSummary<TSchema>> {
        // Emit the before permanently delete from trash event
        const beforePermanentlyDeleteFromTrashEvent = new MutationEvent<InferSummary<TSchema>, InferLookup<TSchema>>(
            this.getDescriptor(ModelMutationAction.BeforePermanentlyDeleteFromTrash),
            lookup,
        )
        await this.emitter.emitAsync(beforePermanentlyDeleteFromTrashEvent)

        // Perform the permanent deletion from trash
        const result = await this.repository.permanentlyDeleteFromTrash(lookup)

        // Emit the after permanently delete from trash event
        const afterPermanentlyDeleteFromTrashEvent = new MutationEvent<InferSummary<TSchema>, InferLookup<TSchema>>(
            this.getDescriptor(ModelMutationAction.AfterPermanentlyDeleteFromTrash),
            lookup,
        ).setResult(result)
        await this.emitter.emitAsync(afterPermanentlyDeleteFromTrashEvent)

        // Return the results of the permanent deletion
        return await this.normalizeSummary(result)
    }

    /**
     * Permanently deletes an item based on the provided lookup, regardless of whether it is active or in trash.
     * @param lookup The lookup criteria for the item to permanently delete.
     * @returns The permanently deleted item summary.
     */
    async permanentlyDelete(lookup: InferLookup<TSchema>): Promise<InferSummary<TSchema>> {
        // Emit the before permanently delete event
        const beforePermanentlyDeleteEvent = new MutationEvent<InferSummary<TSchema>, InferLookup<TSchema>>(
            this.getDescriptor(ModelMutationAction.BeforePermanentlyDelete),
            lookup,
        )
        await this.emitter.emitAsync(beforePermanentlyDeleteEvent)

        // Perform the permanent deletion
        const result = await this.repository.permanentlyDelete(lookup)

        // Emit the after permanently delete event
        const afterPermanentlyDeleteEvent = new MutationEvent<InferSummary<TSchema>, InferLookup<TSchema>>(
            this.getDescriptor(ModelMutationAction.AfterPermanentlyDelete),
            lookup,
        ).setResult(result)
        await this.emitter.emitAsync(afterPermanentlyDeleteEvent)

        // Return the results of the permanent deletion
        return await this.normalizeSummary(result)
    }
}
