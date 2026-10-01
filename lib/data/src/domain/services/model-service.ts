import type { ActionDescriptor, AnyModelSchema, IAnyModel } from '@declaro/core'
import type {
    InferDetail,
    InferFilters,
    InferInput,
    InferLookup,
    InferSummary,
} from '../../shared/utils/schema-inference'
import { ModelMutationAction } from '../events/event-types'
import {
    ModelMutationEvent,
    type IDuplicateMutationArgs,
    type IModelMutationArgs,
    type IModelMutationEventMeta,
    type IMutationEntry,
} from '../events/model-mutation-event'
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

/**
 * The options every mutation accepts, as far as event dispatch is concerned.
 */
interface IDispatchOptions {
    doNotDispatchEvents?: boolean
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
     * Builds the event for a mutation action. Every entity the action touches is one entry, and the
     * event knows the schema's primary key so entries can be looked up by key.
     * @param action The lifecycle action the event announces.
     * @param entries The entries of the batch, one per entity.
     * @param args The call-level arguments of the mutation.
     * @returns The event, ready to dispatch.
     */
    protected createMutationEvent<
        TResult,
        TInput,
        TLookup = unknown,
        TArgs extends IModelMutationArgs = IModelMutationArgs,
    >(
        action: ModelMutationAction,
        entries: IMutationEntry<TResult, TInput, TLookup>[],
        args?: TArgs,
    ): ModelMutationEvent<TResult, TInput, TLookup, IModelMutationEventMeta<TArgs>> {
        return new ModelMutationEvent<TResult, TInput, TLookup, IModelMutationEventMeta<TArgs>>(
            this.getDescriptor(action),
            entries,
            { primaryKey: this.entityMetadata?.primaryKey, args },
        )
    }

    /**
     * Dispatches a mutation event for the given action, unless the options ask not to or there is
     * nothing to announce.
     *
     * The event is returned so the caller can read back what subscribers changed: a before-event
     * subscriber may replace an entry's input, an after-event subscriber may replace its result.
     *
     * @param action The lifecycle action the event announces.
     * @param entries The entries of the batch, one per entity.
     * @param args The call-level arguments of the mutation.
     * @param options The options of the mutation, checked for `doNotDispatchEvents`.
     * @returns The dispatched event, or undefined when no event was dispatched.
     */
    protected async dispatchMutation<
        TResult,
        TInput,
        TLookup = unknown,
        TArgs extends IModelMutationArgs = IModelMutationArgs,
    >(
        action: ModelMutationAction,
        entries: IMutationEntry<TResult, TInput, TLookup>[],
        args?: TArgs,
        options?: IDispatchOptions,
    ): Promise<ModelMutationEvent<TResult, TInput, TLookup, IModelMutationEventMeta<TArgs>> | undefined> {
        if (options?.doNotDispatchEvents || entries.length === 0) {
            return undefined
        }
        const event = this.createMutationEvent<TResult, TInput, TLookup, TArgs>(action, entries, args)
        await this.emitter.emitAsync(event)
        return event
    }

    /**
     * Converts a detail object to a valid input for this service's schema.
     * Picks only fields that exist in the input model and validates/coerces
     * them through the input schema. Useful for duplicating entities or
     * converting a detail from one entity type into an input for another.
     * @param detail The detail object to convert (can be from any schema).
     * @returns A validated input object with coerced values.
     */
    async detailsToInput(detail: Record<string, unknown>): Promise<InferInput<TSchema>> {
        const inputModel: IAnyModel = this.schema.definition.input
        const inputJsonSchema = inputModel.toJSONSchema()
        const inputFields = Object.keys(inputJsonSchema.properties ?? {})

        // Pick only fields that exist in the input model.
        // Own properties only: a detail loaded from a service is wrapped for serialization, and
        // `in` would also match the methods that wrapping adds.
        const picked: Record<string, unknown> = {}
        for (const field of inputFields) {
            if (Object.prototype.hasOwnProperty.call(detail, field)) {
                picked[field] = detail[field]
            }
        }

        // Validate through the input model to coerce values
        const result = await inputModel.validate(picked as any)

        if ('value' in result) {
            return result.value as InferInput<TSchema>
        }

        return picked as InferInput<TSchema>
    }

    /**
     * Duplicates an existing entity by loading it, converting to input, removing the
     * primary key, and creating a new record. Accepts an optional partial input to
     * merge on top of the converted copy before creation.
     * @param lookup The lookup criteria to find the record to duplicate.
     * @param overrides Optional partial input to merge on top of the duplicated data.
     * @param options Optional create options.
     * @returns The newly created duplicate record.
     */
    async duplicate(
        lookup: InferLookup<TSchema>,
        overrides?: Partial<InferInput<TSchema>>,
        options?: ICreateOptions,
    ): Promise<InferDetail<TSchema>> {
        // Load the existing entity
        const existing = await this.load(lookup)
        if (!existing) {
            throw new Error('Item not found')
        }

        // Convert the detail to an input
        const input = await this.detailsToInput(existing as Record<string, unknown>)

        // Remove the primary key to ensure a new record gets created
        if (this.entityMetadata?.primaryKey) {
            delete (input as Record<string, unknown>)[this.entityMetadata.primaryKey]
        }

        // Merge optional overrides
        const finalInput = (overrides ? Object.assign({}, input, overrides) : input) as InferInput<TSchema>

        const args: IDuplicateMutationArgs<InferInput<TSchema>> = {
            overrides,
            options: options as Record<string, unknown>,
        }
        const entry: IMutationEntry<InferDetail<TSchema>, InferInput<TSchema>, InferLookup<TSchema>> = {
            lookup,
            input: finalInput,
            existing,
        }

        // Emit the before duplicate event
        const beforeDuplicateEvent = await this.dispatchMutation<
            InferDetail<TSchema>,
            InferInput<TSchema>,
            InferLookup<TSchema>,
            IDuplicateMutationArgs<InferInput<TSchema>>
        >(ModelMutationAction.BeforeDuplicate, [entry], args, options)
        const inputToCreate = beforeDuplicateEvent?.entries[0]?.input ?? finalInput

        // Create the new record (also emits beforeCreate/afterCreate)
        const result = await this.create(inputToCreate, options)

        // Emit the after duplicate event
        const afterDuplicateEvent = await this.dispatchMutation<
            InferDetail<TSchema>,
            InferInput<TSchema>,
            InferLookup<TSchema>,
            IDuplicateMutationArgs<InferInput<TSchema>>
        >(ModelMutationAction.AfterDuplicate, [{ ...entry, input: inputToCreate, result }], args, options)

        return afterDuplicateEvent?.entries[0]?.result ?? result
    }

    /**
     * Removes a record by its lookup criteria.
     * @param lookup The lookup criteria to find the record.
     * @returns The removed record.
     */
    async remove(lookup: InferLookup<TSchema>, options?: ILoadOptions): Promise<InferSummary<TSchema>> {
        const normalizedLookup = await this.normalizeLookup(lookup)
        const args: IModelMutationArgs = { options: options as Record<string, unknown> }
        const entry: IMutationEntry<InferSummary<TSchema>, InferLookup<TSchema>, InferLookup<TSchema>> = {
            lookup: normalizedLookup,
            input: normalizedLookup,
        }

        // Emit the before remove event
        const beforeRemoveEvent = await this.dispatchMutation<
            InferSummary<TSchema>,
            InferLookup<TSchema>,
            InferLookup<TSchema>
        >(ModelMutationAction.BeforeRemove, [entry], args, options)
        const lookupToRemove = beforeRemoveEvent?.entries[0]?.input ?? normalizedLookup

        // Perform the removal
        const result = await this.repository.remove(lookupToRemove, options)

        // Emit the after remove event
        const afterRemoveEvent = await this.dispatchMutation<
            InferSummary<TSchema>,
            InferLookup<TSchema>,
            InferLookup<TSchema>
        >(ModelMutationAction.AfterRemove, [{ ...entry, input: lookupToRemove, result }], args, options)

        // Return the results of the removal
        return this.wrapSummary(await this.normalizeSummary(afterRemoveEvent?.entries[0]?.result ?? result))
    }

    /**
     * Restores a record by its lookup criteria.
     * If a soft-deleted copy exists, it will be restored.
     * @param lookup The lookup criteria to find the record to restore.
     * @returns
     */
    async restore(lookup: InferLookup<TSchema>, options?: ILoadOptions): Promise<InferSummary<TSchema>> {
        const normalizedLookup = await this.normalizeLookup(lookup)
        const args: IModelMutationArgs = { options: options as Record<string, unknown> }
        const entry: IMutationEntry<InferSummary<TSchema>, InferLookup<TSchema>, InferLookup<TSchema>> = {
            lookup: normalizedLookup,
            input: normalizedLookup,
        }

        // Emit the before restore event
        const beforeRestoreEvent = await this.dispatchMutation<
            InferSummary<TSchema>,
            InferLookup<TSchema>,
            InferLookup<TSchema>
        >(ModelMutationAction.BeforeRestore, [entry], args, options)
        const lookupToRestore = beforeRestoreEvent?.entries[0]?.input ?? normalizedLookup

        // Perform the restore operation
        const result = await this.repository.restore(lookupToRestore, options)

        // Emit the after restore event
        const afterRestoreEvent = await this.dispatchMutation<
            InferSummary<TSchema>,
            InferLookup<TSchema>,
            InferLookup<TSchema>
        >(ModelMutationAction.AfterRestore, [{ ...entry, input: lookupToRestore, result }], args, options)

        // Return the results of the restore operation
        return this.wrapSummary(await this.normalizeSummary(afterRestoreEvent?.entries[0]?.result ?? result))
    }

    async create(input: InferInput<TSchema>, options?: ICreateOptions): Promise<InferDetail<TSchema>> {
        // Normalize the input data
        const normalizedInput = await this.normalizeInput(input, {
            descriptor: this.getDescriptor(ModelMutationAction.Create),
        })
        const args: IModelMutationArgs = { options: options as Record<string, unknown> }
        const entry: IMutationEntry<InferDetail<TSchema>, InferInput<TSchema>> = { input: normalizedInput }

        // Emit the before create event
        const beforeCreateEvent = await this.dispatchMutation<InferDetail<TSchema>, InferInput<TSchema>>(
            ModelMutationAction.BeforeCreate,
            [entry],
            args,
            options,
        )
        const inputToCreate = beforeCreateEvent?.entries[0]?.input ?? normalizedInput

        // Perform the creation
        const result = await this.repository.create(inputToCreate, options)

        // Emit the after create event
        const afterCreateEvent = await this.dispatchMutation<InferDetail<TSchema>, InferInput<TSchema>>(
            ModelMutationAction.AfterCreate,
            [{ ...entry, input: inputToCreate, result }],
            args,
            options,
        )

        // Return the results of the creation
        return this.wrapDetail(await this.normalizeDetail(afterCreateEvent?.entries[0]?.result ?? result))
    }

    async update(
        lookup: InferLookup<TSchema>,
        input: InferInput<TSchema>,
        options?: IUpdateOptions,
    ): Promise<InferDetail<TSchema>> {
        const normalizedLookup = await this.normalizeLookup(lookup)
        const existing = await this.repository.load(normalizedLookup, { ...options, doNotDispatchEvents: true })
        // Normalize the input data
        const normalizedInput = await this.normalizeInput(input, {
            existing,
            descriptor: this.getDescriptor(ModelMutationAction.Update),
        })
        const args: IModelMutationArgs = { options: options as Record<string, unknown> }
        const entry: IMutationEntry<InferDetail<TSchema>, InferInput<TSchema>, InferLookup<TSchema>> = {
            lookup: normalizedLookup,
            input: normalizedInput,
            existing: existing ?? undefined,
        }

        // Emit the before update event
        const beforeUpdateEvent = await this.dispatchMutation<
            InferDetail<TSchema>,
            InferInput<TSchema>,
            InferLookup<TSchema>
        >(ModelMutationAction.BeforeUpdate, [entry], args, options)
        const inputToUpdate = beforeUpdateEvent?.entries[0]?.input ?? normalizedInput

        // Perform the update
        const result = await this.repository.update(normalizedLookup, inputToUpdate, options)

        // Emit the after update event
        const afterUpdateEvent = await this.dispatchMutation<
            InferDetail<TSchema>,
            InferInput<TSchema>,
            InferLookup<TSchema>
        >(ModelMutationAction.AfterUpdate, [{ ...entry, input: inputToUpdate, result }], args, options)

        // Return the results of the update
        return this.wrapDetail(await this.normalizeDetail(afterUpdateEvent?.entries[0]?.result ?? result))
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
        let lookup: InferLookup<TSchema> | undefined = undefined
        let existingItem: InferDetail<TSchema> | undefined = undefined

        if (primaryKeyValue === undefined) {
            operation = ModelMutationAction.Create
            beforeOperation = ModelMutationAction.BeforeCreate
            afterOperation = ModelMutationAction.AfterCreate
        } else {
            lookup = {
                [this.entityMetadata.primaryKey]: primaryKeyValue,
            } as InferLookup<TSchema>
            existingItem = await this.load(lookup, {
                ...options,
                doNotDispatchEvents: true,
            })

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
        const args: IModelMutationArgs = { options: options as Record<string, unknown> }
        const entry: IMutationEntry<InferDetail<TSchema>, InferInput<TSchema>, InferLookup<TSchema>> = {
            lookup,
            input: normalizedInput,
            existing: existingItem ?? undefined,
        }

        // Emit the before upsert event
        const beforeUpsertEvent = await this.dispatchMutation<
            InferDetail<TSchema>,
            InferInput<TSchema>,
            InferLookup<TSchema>
        >(beforeOperation, [entry], args, options)
        const inputToUpsert = beforeUpsertEvent?.entries[0]?.input ?? normalizedInput

        // Perform the upsert operation
        const result = await this.repository.upsert(inputToUpsert, options)

        // Emit the after upsert event
        const afterUpsertEvent = await this.dispatchMutation<
            InferDetail<TSchema>,
            InferInput<TSchema>,
            InferLookup<TSchema>
        >(afterOperation, [{ ...entry, input: inputToUpsert, result }], args, options)

        // Return the results of the upsert operation
        return this.wrapDetail(await this.normalizeDetail(afterUpsertEvent?.entries[0]?.result ?? result))
    }

    /**
     * Bulk upserts multiple records (creates if they don't exist, updates if they do).
     *
     * The batch is announced with at most four events: one `beforeCreate` carrying every entry that
     * will be created, one `beforeUpdate` carrying every entry that will be updated, and the matching
     * `afterCreate` and `afterUpdate` once the repository has written. An event whose group is empty
     * is not dispatched.
     *
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

        type Entry = IMutationEntry<InferDetail<TSchema>, InferInput<TSchema>, InferLookup<TSchema>>

        // Collect the unique lookups of the inputs that carry a primary key
        const uniqueLookups = new Map<string | number, InferLookup<TSchema>>()
        for (const input of inputs) {
            const primaryKeyValue = this.getPrimaryKeyValue(input)
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

        // Build one entry per input (preserves order and duplicates), normalizing in parallel
        const entries: Entry[] = await Promise.all(
            inputs.map(async (input): Promise<Entry> => {
                const primaryKeyValue = this.getPrimaryKeyValue(input)
                const lookup = primaryKeyValue !== undefined ? uniqueLookups.get(primaryKeyValue) : undefined
                const existing = primaryKeyValue !== undefined ? existingEntitiesMap.get(primaryKeyValue) : undefined

                const normalizedInput = await this.normalizeInput(input, {
                    existing,
                    descriptor: this.getDescriptor(existing ? ModelMutationAction.Update : ModelMutationAction.Create),
                })

                return { lookup, input: normalizedInput, existing }
            }),
        )

        const isUpdate = (entry: Entry) => entry.existing !== undefined
        const args: IModelMutationArgs = { options: options as Record<string, unknown> }

        // Emit the before events: one for the creates, one for the updates. The entry objects are
        // shared with `entries`, so an input a subscriber replaces is the one written below.
        await this.dispatchMutation<InferDetail<TSchema>, InferInput<TSchema>, InferLookup<TSchema>>(
            ModelMutationAction.BeforeCreate,
            entries.filter((entry) => !isUpdate(entry)),
            args,
            options,
        )
        await this.dispatchMutation<InferDetail<TSchema>, InferInput<TSchema>, InferLookup<TSchema>>(
            ModelMutationAction.BeforeUpdate,
            entries.filter(isUpdate),
            args,
            options,
        )

        // Perform the bulk upsert operation with all normalized inputs
        const results = await this.repository.bulkUpsert(
            entries.map((entry) => entry.input),
            options,
        )

        // Emit the after events: one for the creates, one for the updates
        const afterEntries: Entry[] = entries.map((entry, i) => ({ ...entry, result: results[i] }))
        await this.dispatchMutation<InferDetail<TSchema>, InferInput<TSchema>, InferLookup<TSchema>>(
            ModelMutationAction.AfterCreate,
            afterEntries.filter((entry) => !isUpdate(entry)),
            args,
            options,
        )
        await this.dispatchMutation<InferDetail<TSchema>, InferInput<TSchema>, InferLookup<TSchema>>(
            ModelMutationAction.AfterUpdate,
            afterEntries.filter(isUpdate),
            args,
            options,
        )

        // Return normalized results, honoring any result a subscriber replaced
        const finalResults = afterEntries.map((entry, i) => entry.result ?? results[i])
        return this.wrapDetails(await Promise.all(finalResults.map((result) => this.normalizeDetail(result))))
    }

    /**
     * Permanently deletes all items from trash, optionally filtered by the provided criteria.
     *
     * This is the one mutation that is not announced per entity: nothing identifies the records it
     * deletes except the filters, so its events stay plain `MutationEvent`s carrying the filters as
     * input and the deleted count as result.
     *
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
        const normalizedLookup = await this.normalizeLookup(lookup)
        const entry: IMutationEntry<InferSummary<TSchema>, InferLookup<TSchema>, InferLookup<TSchema>> = {
            lookup: normalizedLookup,
            input: normalizedLookup,
        }

        // Emit the before permanently delete from trash event
        const beforeEvent = await this.dispatchMutation<
            InferSummary<TSchema>,
            InferLookup<TSchema>,
            InferLookup<TSchema>
        >(ModelMutationAction.BeforePermanentlyDeleteFromTrash, [entry])
        const lookupToDelete = beforeEvent?.entries[0]?.input ?? normalizedLookup

        // Perform the permanent deletion from trash
        const result = await this.repository.permanentlyDeleteFromTrash(lookupToDelete)

        // Emit the after permanently delete from trash event
        const afterEvent = await this.dispatchMutation<
            InferSummary<TSchema>,
            InferLookup<TSchema>,
            InferLookup<TSchema>
        >(ModelMutationAction.AfterPermanentlyDeleteFromTrash, [{ ...entry, input: lookupToDelete, result }])

        // Return the results of the permanent deletion
        return this.wrapSummary(await this.normalizeSummary(afterEvent?.entries[0]?.result ?? result))
    }

    /**
     * Permanently deletes an item based on the provided lookup, regardless of whether it is active or in trash.
     * @param lookup The lookup criteria for the item to permanently delete.
     * @returns The permanently deleted item summary.
     */
    async permanentlyDelete(lookup: InferLookup<TSchema>): Promise<InferSummary<TSchema>> {
        const normalizedLookup = await this.normalizeLookup(lookup)
        const entry: IMutationEntry<InferSummary<TSchema>, InferLookup<TSchema>, InferLookup<TSchema>> = {
            lookup: normalizedLookup,
            input: normalizedLookup,
        }

        // Emit the before permanently delete event
        const beforeEvent = await this.dispatchMutation<
            InferSummary<TSchema>,
            InferLookup<TSchema>,
            InferLookup<TSchema>
        >(ModelMutationAction.BeforePermanentlyDelete, [entry])
        const lookupToDelete = beforeEvent?.entries[0]?.input ?? normalizedLookup

        // Perform the permanent deletion
        const result = await this.repository.permanentlyDelete(lookupToDelete)

        // Emit the after permanently delete event
        const afterEvent = await this.dispatchMutation<
            InferSummary<TSchema>,
            InferLookup<TSchema>,
            InferLookup<TSchema>
        >(ModelMutationAction.AfterPermanentlyDelete, [{ ...entry, input: lookupToDelete, result }])

        // Return the results of the permanent deletion
        return this.wrapSummary(await this.normalizeSummary(afterEvent?.entries[0]?.result ?? result))
    }
}
