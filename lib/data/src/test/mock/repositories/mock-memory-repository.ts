import type { AnyModelSchema, IModelEntityMetadata, JSONSchema, Model } from '@declaro/core'
import type { IRepository } from '../../../domain/interfaces/repository'
import type { IPaginationInput } from '../../../domain/models/pagination'
import type {
    InferDetail,
    InferFilters,
    InferInput,
    InferLookup,
    InferSearchResults,
    InferSummary,
} from '../../../shared/utils/schema-inference'
import { v4 as uuid } from 'uuid'
import type { ILoadOptions, ISearchOptions } from '../../../domain/services/read-only-model-service'
import type { ICreateOptions, IUpdateOptions } from '../../../domain/services/model-service'

export interface IMockMemoryRepositoryArgs<TSchema extends AnyModelSchema> {
    schema: TSchema
    lookup?: (data: InferDetail<TSchema>, lookup: InferLookup<TSchema>) => boolean
    filter?: (data: InferSummary<TSchema>, filters: InferFilters<TSchema>) => boolean
    assign?: (data: InferDetail<TSchema>, input: InferInput<TSchema>) => InferDetail<TSchema>
}

export class MockMemoryRepository<TSchema extends AnyModelSchema> implements IRepository<TSchema> {
    protected data = new Map<string, InferDetail<TSchema>>()
    protected trash = new Map<string, InferDetail<TSchema>>()
    protected entityMetadata: IModelEntityMetadata
    protected nextId: number = 0

    constructor(protected args: IMockMemoryRepositoryArgs<TSchema>) {
        this.entityMetadata = this.args.schema.getEntityMetadata()
        if (!this.entityMetadata?.primaryKey) {
            throw new Error('Primary key must be specified for MockMemoryRepository')
        }
    }

    private findOne(
        lookup: InferLookup<TSchema>,
        map: Map<string, InferDetail<TSchema>>,
    ): InferDetail<TSchema> | undefined {
        if (typeof this.args.lookup === 'function') {
            return Array.from(map.values()).find((data) => this.args.lookup!(data, lookup))
        } else {
            // Default lookup by primary key
            return map.get(lookup[this.entityMetadata.primaryKey])
        }
    }

    /**
     * Find an item and return both the item and its key
     * @param lookup - The lookup criteria
     * @param map - The map to search in
     * @returns Object containing the item and its key, or undefined if not found
     */
    private findOneWithKey(
        lookup: InferLookup<TSchema>,
        map: Map<string, InferDetail<TSchema>>,
    ): { item: InferDetail<TSchema>; key: string } | undefined {
        if (typeof this.args.lookup === 'function') {
            const item = Array.from(map.values()).find((data) => this.args.lookup!(data, lookup))
            if (item) {
                return { item, key: item[this.entityMetadata.primaryKey!] }
            }
        } else {
            // Default lookup by primary key
            const key = lookup[this.entityMetadata.primaryKey]
            const item = map.get(key)
            if (item) {
                return { item, key }
            }
        }
        return undefined
    }

    /**
     * Loads a single item by lookup criteria.
     * @param input - The lookup criteria.
     * @param options - Optional load options including removedOnly and includeRemoved.
     * @returns The found item or null if not found.
     */
    async load(input: InferLookup<TSchema>, options: ILoadOptions = {}): Promise<InferDetail<TSchema> | null> {
        if (!this.entityMetadata?.primaryKey) {
            throw new Error('Primary key is not defined in the schema metadata')
        }

        let item: InferDetail<TSchema> | undefined

        if (options.removedOnly) {
            item = this.findOne(input, this.trash)
        } else if (options.includeRemoved) {
            item = this.findOne(input, this.data) ?? this.findOne(input, this.trash)
        } else {
            item = this.findOne(input, this.data)
        }

        return item || null
    }
    async loadMany(inputs: InferLookup<TSchema>[]): Promise<InferDetail<TSchema>[]> {
        if (!this.entityMetadata?.primaryKey) {
            throw new Error('Primary key is not defined in the schema metadata')
        }

        const results: InferDetail<TSchema>[] = []
        for (const input of inputs) {
            let item: InferDetail<TSchema> | undefined
            if (typeof this.args.lookup === 'function') {
                item = Array.from(this.data.values()).find((data) => this.args.lookup!(data, input))
            } else {
                // Default lookup by primary key
                item = this.data.get(input[this.entityMetadata.primaryKey!])
            }
            if (item) {
                results.push(item)
            }
        }
        return results
    }
    async search(
        input: InferFilters<TSchema>,
        options?: ISearchOptions<TSchema>,
    ): Promise<InferSearchResults<TSchema>> {
        const pagination = options?.pagination || { page: 1, pageSize: 25 }
        let items = this.applyFilters(input, options)

        // Apply sorting if provided
        if (options?.sort && Array.isArray(options.sort)) {
            items = items.sort((a, b) => {
                for (const sortField of options.sort! as any[]) {
                    for (const [field, direction] of Object.entries(sortField)) {
                        if (!direction || typeof direction !== 'string') continue

                        const aValue = a[field as keyof typeof a]
                        const bValue = b[field as keyof typeof b]

                        let comparison = 0
                        if (aValue < bValue) comparison = -1
                        else if (aValue > bValue) comparison = 1

                        if (comparison !== 0) {
                            // Handle different sort directions
                            const isDesc = direction.includes('desc')
                            return isDesc ? -comparison : comparison
                        }
                    }
                }
                return 0
            })
        }

        return {
            results: items.slice(
                ((pagination?.page ?? 1) - 1) * (pagination?.pageSize ?? 25),
                (pagination?.page ?? 1) * (pagination?.pageSize ?? 25),
            ),
            pagination: {
                total: items.length,
                totalPages: Math.ceil(items.length / (pagination?.pageSize ?? 25)),
                ...pagination,
                page: pagination?.page ?? 1,
                pageSize: pagination?.pageSize ?? 25,
            },
        }
    }
    async remove(lookup: InferLookup<TSchema>): Promise<InferSummary<TSchema>> {
        if (!this.entityMetadata?.primaryKey) {
            throw new Error('Primary key is not defined in the schema metadata')
        }

        const found = this.findOneWithKey(lookup, this.data)
        if (!found) {
            throw new Error('Item not found')
        }

        // Move the item to trash
        this.trash.set(found.key, found.item)
        // Remove the item from data
        this.data.delete(found.key)
        return found.item
    }
    async restore(lookup: InferLookup<TSchema>): Promise<InferSummary<TSchema>> {
        if (!this.entityMetadata?.primaryKey) {
            throw new Error('Primary key is not defined in the schema metadata')
        }

        const found = this.findOneWithKey(lookup, this.trash)
        if (!found) {
            throw new Error('Item not found in trash')
        }

        this.trash.delete(found.key)
        this.data.set(found.key, found.item)
        return found.item
    }

    async create(input: InferInput<TSchema>): Promise<InferDetail<TSchema>> {
        if (!this.entityMetadata?.primaryKey) {
            throw new Error('Primary key is not defined in the schema metadata')
        }
        const primaryKeyValue = input[this.entityMetadata.primaryKey]

        if (primaryKeyValue && this.data.has(primaryKeyValue)) {
            throw new Error('Item with the same primary key already exists')
        }

        const baseData = {} as InferDetail<TSchema>
        const payload = this.assignInput(baseData, input)

        if (!payload[this.entityMetadata.primaryKey]) {
            // Generate a new primary key if not provided
            payload[this.entityMetadata.primaryKey!] = await this.generatePrimaryKey()
        }

        this.data.set(payload[this.entityMetadata.primaryKey!], payload)
        return payload
    }

    async update(lookup: InferLookup<TSchema>, input: InferInput<TSchema>): Promise<InferDetail<TSchema>> {
        if (!this.entityMetadata?.primaryKey) {
            throw new Error('Primary key is not defined in the schema metadata')
        }

        let existingItem: InferDetail<TSchema> | undefined
        let itemKey: string

        if (typeof this.args.lookup === 'function') {
            existingItem = Array.from(this.data.values()).find((data) => this.args.lookup!(data, lookup))
            if (existingItem) {
                itemKey = existingItem[this.entityMetadata.primaryKey!]
            } else {
                throw new Error('Item not found')
            }
        } else {
            // Default lookup by primary key
            itemKey = lookup[this.entityMetadata.primaryKey]
            if (!itemKey) {
                throw new Error('Primary key value must be provided')
            }
            existingItem = this.data.get(itemKey)
            if (!existingItem) {
                throw new Error('Item not found')
            }
        }

        const updatedItem = this.assignInput(existingItem, input)
        this.data.set(itemKey!, updatedItem)
        return updatedItem
    }

    async count(search: InferFilters<TSchema>, options?: ISearchOptions<TSchema> | undefined): Promise<number> {
        const filteredItems = this.applyFilters(search, options)
        return filteredItems.length
    }

    async upsert(input: InferInput<TSchema>, options?: ICreateOptions | IUpdateOptions): Promise<InferDetail<TSchema>> {
        const primaryKeyValue = input[this.entityMetadata.primaryKey]
        let existingItem: InferDetail<TSchema> = {} as InferDetail<TSchema>

        if (primaryKeyValue) {
            existingItem = this.data.get(primaryKeyValue) ?? ({} as InferDetail<TSchema>)
        }

        const updatedItem = this.assignInput(existingItem, input)
        if (!updatedItem[this.entityMetadata.primaryKey!]) {
            updatedItem[this.entityMetadata.primaryKey!] = await this.generatePrimaryKey()
        }

        this.data.set(updatedItem[this.entityMetadata.primaryKey!], updatedItem)

        return updatedItem
    }

    async bulkUpsert(
        inputs: InferInput<TSchema>[],
        options?: ICreateOptions | IUpdateOptions,
    ): Promise<InferDetail<TSchema>[]> {
        return await Promise.all(inputs.map((input) => this.upsert(input, options)))
    }

    async permanentlyDelete(lookup: InferLookup<TSchema>): Promise<InferSummary<TSchema>> {
        if (!this.entityMetadata?.primaryKey) {
            throw new Error('Primary key is not defined in the schema metadata')
        }

        // Try to find in main data first, then trash
        const foundInData = this.findOneWithKey(lookup, this.data)
        if (foundInData) {
            this.data.delete(foundInData.key)
            return foundInData.item
        }

        const foundInTrash = this.findOneWithKey(lookup, this.trash)
        if (foundInTrash) {
            this.trash.delete(foundInTrash.key)
            return foundInTrash.item
        }

        throw new Error('Item not found')
    }

    async permanentlyDeleteFromTrash(lookup: InferLookup<TSchema>): Promise<InferSummary<TSchema>> {
        if (!this.entityMetadata?.primaryKey) {
            throw new Error('Primary key is not defined in the schema metadata')
        }

        const found = this.findOneWithKey(lookup, this.trash)
        if (!found) {
            throw new Error('Item not found in trash')
        }

        this.trash.delete(found.key)
        return found.item
    }

    async emptyTrash(filters?: InferFilters<TSchema>): Promise<number> {
        if (!filters || Object.keys(filters).length === 0) {
            // Delete all items from trash
            const count = this.trash.size
            this.trash.clear()
            return count
        }

        // Apply filters to trash items
        const itemsToDelete: string[] = []
        for (const [key, item] of this.trash.entries()) {
            if (typeof this.args.filter === 'function') {
                if (this.args.filter(item, filters)) {
                    itemsToDelete.push(key)
                }
            } else {
                // No filter function provided - match all items
                itemsToDelete.push(key)
            }
        }

        // Delete filtered items
        for (const key of itemsToDelete) {
            this.trash.delete(key)
        }

        return itemsToDelete.length
    }

    /**
     * Apply filtering logic to all items based on the provided search criteria
     * @param input - The search/filter criteria
     * @param options - Optional search options including removedOnly and includeRemoved
     * @returns Filtered array of items
     */
    protected applyFilters(input: InferFilters<TSchema>, options?: ISearchOptions<TSchema>): InferDetail<TSchema>[] {
        let sourceItems: InferDetail<TSchema>[]

        if (options?.removedOnly) {
            // Only search in trash
            sourceItems = Array.from(this.trash.values())
        } else if (options?.includeRemoved) {
            // Search in both data and trash
            sourceItems = [...Array.from(this.data.values()), ...Array.from(this.trash.values())]
        } else {
            // Default: only search in active data
            sourceItems = Array.from(this.data.values())
        }

        return sourceItems.filter((item) => {
            // Apply filtering logic based on the input
            if (typeof this.args.filter === 'function') {
                return this.args.filter(item, input)
            } else {
                return true
            }
        })
    }

    /**
     * Assign input data to existing data using the provided assign function or default Object.assign
     * @param existingData - The existing data to merge with
     * @param input - The input data to assign
     * @returns The merged data
     */
    protected assignInput(existingData: InferDetail<TSchema>, input: InferInput<TSchema>): InferDetail<TSchema> {
        if (typeof this.args.assign === 'function') {
            return this.args.assign(existingData, input)
        } else {
            // Default implementation using Object.assign
            return Object.assign({}, existingData, input) as InferDetail<TSchema>
        }
    }

    protected async generatePrimaryKey() {
        const lookupModel: Model<any, any> = this.args.schema.definition.lookup
        const lookupMeta = await lookupModel.toJSONSchema()
        const primaryKeyMeta = lookupMeta.properties?.[this.entityMetadata.primaryKey!] as JSONSchema
        const type = primaryKeyMeta.type as string

        if (type === 'string') {
            return uuid()
        } else if (['number', 'integer'].includes(type)) {
            return ++this.nextId
        } else {
            throw new Error(`Unsupported primary key type: ${type}`)
        }
    }
}
