import type { AnyModelSchema, IActionDescriptorInput } from '@declaro/core'
import type { InferDetail, InferInput, InferLookup, InferSummary } from '../../shared/utils/schema-inference'
import { DomainEvent } from './domain-event'

/**
 * The value of an entity's primary key.
 */
export type EntityKey = string | number

/**
 * One entity's slice of a model mutation.
 *
 * Everything the mutation knows about a single entity lives together on its entry, so a subscriber
 * never has to line up an input against a result by position. Which fields are present depends on
 * the action and on whether the event fires before or after the write:
 *
 * | Action                      | `lookup` | `input`                | `existing`          | `result` (after only) |
 * | --------------------------- | -------- | ---------------------- | ------------------- | --------------------- |
 * | create                      |          | normalized input       |                     | created detail        |
 * | update                      | yes      | normalized input       | record before write | updated detail        |
 * | duplicate                   | source   | input for the copy     | source record       | the new copy          |
 * | remove / restore / delete   | yes      | the lookup             |                     | summary               |
 *
 * `key` is the primary key value when it is known. It is always known after the write. Before a
 * create it is only known when the input carries one.
 */
export interface IMutationEntry<TResult, TInput, TLookup = unknown> {
    /**
     * The entity's primary key value, when known.
     */
    key?: EntityKey
    /**
     * The lookup that identified the entity, for actions that start from one.
     */
    lookup?: TLookup
    /**
     * The input the mutation runs with. A before-event subscriber may replace or mutate it, and the
     * service writes whatever is here once every subscriber has run.
     */
    input: TInput
    /**
     * The record as it stood before the write, when the service loaded it.
     */
    existing?: TResult
    /**
     * The record as the repository returned it. Set on after-events only. An after-event subscriber
     * may replace it, and the service returns whatever is here to its caller.
     */
    result?: TResult
}

/**
 * The call-level arguments of a mutation: everything that applies to the batch as a whole rather
 * than to one entity. Per-entity values (input, lookup, existing) live on the entries.
 */
export interface IModelMutationArgs {
    /**
     * The options the caller passed to the service method.
     */
    options?: Record<string, unknown>
}

/**
 * The call-level arguments of a duplicate.
 */
export interface IDuplicateMutationArgs<TInput> extends IModelMutationArgs {
    /**
     * The partial input merged on top of the copied record.
     */
    overrides?: Partial<TInput>
}

/**
 * Metadata carried by every model mutation event.
 */
export interface IModelMutationEventMeta<TArgs extends IModelMutationArgs = IModelMutationArgs> {
    /**
     * The name of the primary key field, so an entry's key can be read off its records.
     */
    primaryKey?: string
    /**
     * The call-level arguments of the mutation.
     */
    args?: TArgs
}

/**
 * The JSON shape of a model mutation event.
 */
export interface IModelMutationEventJSON<TResult, TInput, TLookup, TMeta> {
    eventId: string
    data?: IMutationEntry<TResult, TInput, TLookup>[]
    meta: TMeta
    timestamp: string
    type: string
    session?: { id: string }
}

/**
 * A mutation of one or more entities of a model, dispatched by `ModelService` before and after
 * every create, update, duplicate, remove, restore and permanent delete.
 *
 * The event always carries an array of entries, one per entity, whether the service method touched
 * a single record or a whole batch. Subscribers therefore always iterate, which keeps them correct
 * and efficient when a bulk operation runs:
 *
 * ```ts
 * emitter.on('books::book.afterUpdate', (event: ModelMutationEvent<IBook, IBookInput>) => {
 *     for (const entry of event.entries) {
 *         if (entry.existing?.author !== entry.result?.author) reindex(entry.result)
 *     }
 * })
 * ```
 *
 * The entries are the event's `data`, so the event serializes like any other `DomainEvent`. The
 * primary-key index is built lazily and rebuilt after the event's own setters run; a subscriber
 * that assigns `entry.key` directly calls `reindex()` afterwards.
 *
 * @typeParam TResult The record type the mutation returns (a detail or a summary).
 * @typeParam TInput The input type the mutation runs with (an input or a lookup).
 * @typeParam TLookup The lookup type, for actions that start from one.
 * @typeParam TMeta The metadata type.
 */
export class ModelMutationEvent<
    TResult,
    TInput,
    TLookup = unknown,
    TMeta extends IModelMutationEventMeta = IModelMutationEventMeta,
> extends DomainEvent<IMutationEntry<TResult, TInput, TLookup>[], TMeta> {
    declare data: IMutationEntry<TResult, TInput, TLookup>[]

    private index?: Map<EntityKey, IMutationEntry<TResult, TInput, TLookup>>

    /**
     * @param descriptor The action descriptor, which also names the event type.
     * @param entries The entries of the batch. A single entry is accepted and wrapped in an array.
     * @param meta The event metadata.
     */
    constructor(
        descriptor: IActionDescriptorInput,
        entries: IMutationEntry<TResult, TInput, TLookup>[] | IMutationEntry<TResult, TInput, TLookup> = [],
        meta: TMeta = {} as TMeta,
    ) {
        super({
            descriptor,
            meta,
            data: Array.isArray(entries) ? entries : [entries],
        })
        this.fillKeys()
    }

    /**
     * The entries of the batch, one per entity, in the order the mutation runs them.
     */
    get entries(): IMutationEntry<TResult, TInput, TLookup>[] {
        return this.data
    }

    /**
     * The number of entities in the batch.
     */
    get size(): number {
        return this.data.length
    }

    /**
     * The primary key of every entry whose key is known, in entry order.
     */
    get keys(): EntityKey[] {
        const keys: EntityKey[] = []
        for (const entry of this.data) {
            const key = this.keyOf(entry)
            if (key !== undefined) {
                keys.push(key)
            }
        }
        return keys
    }

    /**
     * The input of every entry, in entry order.
     */
    get inputs(): TInput[] {
        return this.data.map((entry) => entry.input)
    }

    /**
     * The result of every entry that has one, in entry order. Empty before the write.
     */
    get results(): TResult[] {
        const results: TResult[] = []
        for (const entry of this.data) {
            if (entry.result !== undefined) {
                results.push(entry.result)
            }
        }
        return results
    }

    /**
     * The pre-write record of every entry that has one, in entry order.
     */
    get existing(): TResult[] {
        const existing: TResult[] = []
        for (const entry of this.data) {
            if (entry.existing !== undefined) {
                existing.push(entry.existing)
            }
        }
        return existing
    }

    /**
     * The lookup of every entry that has one, in entry order.
     */
    get lookups(): TLookup[] {
        const lookups: TLookup[] = []
        for (const entry of this.data) {
            if (entry.lookup !== undefined) {
                lookups.push(entry.lookup)
            }
        }
        return lookups
    }

    /**
     * Whether the batch holds an entity with the given primary key.
     * @param key The primary key value.
     * @returns True when an entry carries that key.
     */
    has(key: EntityKey): boolean {
        return this.getIndex().has(key)
    }

    /**
     * The entry of the entity with the given primary key.
     * @param key The primary key value.
     * @returns The entry, or undefined when the batch holds no entity with that key.
     */
    get(key: EntityKey): IMutationEntry<TResult, TInput, TLookup> | undefined {
        return this.getIndex().get(key)
    }

    /**
     * The input of the entity with the given primary key.
     * @param key The primary key value.
     * @returns The input, or undefined when the batch holds no entity with that key.
     */
    getInput(key: EntityKey): TInput | undefined {
        return this.get(key)?.input
    }

    /**
     * The post-write record of the entity with the given primary key.
     * @param key The primary key value.
     * @returns The result, or undefined before the write or when the batch holds no such entity.
     */
    getResult(key: EntityKey): TResult | undefined {
        return this.get(key)?.result
    }

    /**
     * The pre-write record of the entity with the given primary key.
     * @param key The primary key value.
     * @returns The existing record, or undefined when none was loaded or the batch holds no such entity.
     */
    getExisting(key: EntityKey): TResult | undefined {
        return this.get(key)?.existing
    }

    /**
     * Replaces the entries of the batch.
     * @param entries The new entries.
     * @returns This event, for chaining.
     */
    setEntries(entries: IMutationEntry<TResult, TInput, TLookup>[]): this {
        this.data = entries
        this.fillKeys()
        return this
    }

    /**
     * Appends an entry to the batch.
     * @param entry The entry to add.
     * @returns This event, for chaining.
     */
    add(entry: IMutationEntry<TResult, TInput, TLookup>): this {
        this.data.push(entry)
        this.fillKeys()
        return this
    }

    /**
     * Assigns the repository's results to the entries by position and fills in any key the result
     * reveals. The results must be in entry order, which is what repositories return.
     * @param results The records the repository returned, one per entry.
     * @returns This event, for chaining.
     * @throws Error when the number of results differs from the number of entries.
     */
    setResults(results: TResult[]): this {
        if (results.length !== this.data.length) {
            throw new Error(
                `Expected ${this.data.length} result(s) for ${this.data.length} entries, received ${results.length}`,
            )
        }
        this.data.forEach((entry, i) => {
            entry.result = results[i]
        })
        this.fillKeys()
        return this
    }

    /**
     * Merges metadata into the event.
     * @param meta The metadata to merge.
     * @returns This event, for chaining.
     */
    setMeta(meta: Partial<TMeta>): this {
        this.meta = { ...this.meta, ...meta }
        return this
    }

    /**
     * Rebuilds the primary-key index. Call this after assigning `entry.key` directly.
     * @returns This event, for chaining.
     */
    reindex(): this {
        this.index = undefined
        return this
    }

    /**
     * Resolves an entry's primary key: the explicit `key`, or the primary key field read off the
     * result, the existing record, the lookup or the input, in that order.
     * @param entry The entry.
     * @returns The key, or undefined when nothing on the entry reveals it.
     */
    keyOf(entry: IMutationEntry<TResult, TInput, TLookup>): EntityKey | undefined {
        if (entry.key !== undefined) {
            return entry.key
        }
        const primaryKey = this.meta.primaryKey
        if (!primaryKey) {
            return undefined
        }
        for (const record of [entry.result, entry.existing, entry.lookup, entry.input]) {
            const value = readKey(record, primaryKey)
            if (value !== undefined) {
                return value
            }
        }
        return undefined
    }

    toJSON(): IModelMutationEventJSON<TResult, TInput, TLookup, TMeta> {
        return super.toJSON()
    }

    /**
     * Writes onto every entry the key its records reveal, and drops the index so it is rebuilt.
     */
    private fillKeys(): void {
        for (const entry of this.data) {
            const key = this.keyOf(entry)
            if (key !== undefined) {
                entry.key = key
            }
        }
        this.index = undefined
    }

    private getIndex(): Map<EntityKey, IMutationEntry<TResult, TInput, TLookup>> {
        if (!this.index) {
            this.index = new Map()
            for (const entry of this.data) {
                const key = this.keyOf(entry)
                if (key !== undefined && !this.index.has(key)) {
                    this.index.set(key, entry)
                }
            }
        }
        return this.index
    }
}

/**
 * The event `ModelService` dispatches before and after a create, typed from the schema. Also used
 * for the create path of an upsert, where the entry carries the lookup that found nothing.
 */
export type ModelCreateEvent<TSchema extends AnyModelSchema> = ModelMutationEvent<
    InferDetail<TSchema>,
    InferInput<TSchema>,
    InferLookup<TSchema>
>

/**
 * The event `ModelService` dispatches before and after an update, typed from the schema. Each entry
 * carries the lookup, the record it found, and the input.
 */
export type ModelUpdateEvent<TSchema extends AnyModelSchema> = ModelMutationEvent<
    InferDetail<TSchema>,
    InferInput<TSchema>,
    InferLookup<TSchema>
>

/**
 * The event `ModelService` dispatches before and after a duplicate, typed from the schema. The entry
 * carries the source lookup, the source record as `existing`, the input for the copy, and after the
 * write the copy as `result`. The overrides are in `meta.args`.
 */
export type ModelDuplicateEvent<TSchema extends AnyModelSchema> = ModelMutationEvent<
    InferDetail<TSchema>,
    InferInput<TSchema>,
    InferLookup<TSchema>,
    IModelMutationEventMeta<IDuplicateMutationArgs<InferInput<TSchema>>>
>

/**
 * The event `ModelService` dispatches before and after a remove, typed from the schema. The entry
 * carries the lookup (as both `lookup` and `input`) and after the write the removed summary.
 */
export type ModelRemoveEvent<TSchema extends AnyModelSchema> = ModelMutationEvent<
    InferSummary<TSchema>,
    InferLookup<TSchema>,
    InferLookup<TSchema>
>

/**
 * The event `ModelService` dispatches before and after a restore, typed from the schema.
 */
export type ModelRestoreEvent<TSchema extends AnyModelSchema> = ModelRemoveEvent<TSchema>

/**
 * The event `ModelService` dispatches before and after a permanent delete, from trash or outright,
 * typed from the schema.
 */
export type ModelPermanentDeleteEvent<TSchema extends AnyModelSchema> = ModelRemoveEvent<TSchema>

/**
 * Reads a primary key value off a record, when the record is an object that has one.
 * @param record The record.
 * @param primaryKey The primary key field name.
 * @returns The key value, or undefined.
 */
function readKey(record: unknown, primaryKey: string): EntityKey | undefined {
    if (record === null || typeof record !== 'object') {
        return undefined
    }
    const value = (record as Record<string, unknown>)[primaryKey]
    return typeof value === 'string' || typeof value === 'number' ? value : undefined
}
