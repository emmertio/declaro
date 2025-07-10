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

export interface IMockMemoryRepositoryArgs<TSchema extends AnyModelSchema> {
    schema: TSchema
}

export class MockMemoryRepository<TSchema extends AnyModelSchema> implements IRepository<TSchema> {
    protected data = new Map<string, InferDetail<TSchema>>()
    protected trash = new Map<string, InferDetail<TSchema>>()
    protected entityMetadata: IModelEntityMetadata<any>
    protected nextId: number = 0

    constructor(protected args: IMockMemoryRepositoryArgs<TSchema>) {
        this.entityMetadata = this.args.schema.getEntityMetadata()
        if (!this.entityMetadata.primaryKey) {
            throw new Error('Primary key must be specified for MockMemoryRepository')
        }
    }

    async load(input: InferLookup<TSchema>): Promise<InferDetail<TSchema>> {
        if (!this.entityMetadata?.primaryKey) {
            throw new Error('Primary key is not defined in the schema metadata')
        }

        const item = await this.data.get(input[this.entityMetadata.primaryKey])
        if (!item) {
            throw new Error('Item not found')
        }

        return item
    }
    async loadMany(inputs: InferLookup<TSchema>[]): Promise<InferDetail<TSchema>[]> {
        if (!this.entityMetadata?.primaryKey) {
            throw new Error('Primary key is not defined in the schema metadata')
        }

        const items = await Promise.all(inputs.map((input) => this.data.get(input[this.entityMetadata.primaryKey!])))
        return items
    }
    async search(input: InferFilters<TSchema>, pagination?: IPaginationInput): Promise<InferSearchResults<TSchema>> {
        const items = Array.from(this.data.values()).filter((item) => {
            // Apply filtering logic based on the input
            return true
        })
        return {
            results: items.slice(
                (pagination?.page ?? 1 - 1) * (pagination?.pageSize ?? 25),
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

        const item = await this.data.get(lookup[this.entityMetadata.primaryKey])
        if (!item) {
            throw new Error('Item not found')
        }
        // Move the item to trash
        this.trash.set(lookup[this.entityMetadata.primaryKey], item)
        // Remove the item from data
        this.data.delete(lookup[this.entityMetadata.primaryKey])
        return item
    }
    async restore(lookup: InferLookup<TSchema>): Promise<InferSummary<TSchema>> {
        if (!this.entityMetadata?.primaryKey) {
            throw new Error('Primary key is not defined in the schema metadata')
        }

        const item = await this.trash.get(lookup[this.entityMetadata.primaryKey])
        if (!item) {
            throw new Error('Item not found in trash')
        }
        this.trash.delete(lookup[this.entityMetadata.primaryKey])
        this.data.set(lookup[this.entityMetadata.primaryKey], item)
        return item
    }

    async create(input: InferInput<TSchema>): Promise<InferDetail<TSchema>> {
        if (!this.entityMetadata?.primaryKey) {
            throw new Error('Primary key is not defined in the schema metadata')
        }
        const primaryKeyValue = input[this.entityMetadata.primaryKey]

        if (primaryKeyValue && this.data.has(primaryKeyValue)) {
            throw new Error('Item with the same primary key already exists')
        }

        const payload = {
            ...(input as any),
        }

        if (!payload[this.entityMetadata.primaryKey]) {
            // Generate a new primary key if not provided
            payload[this.entityMetadata.primaryKey!] = await this.generatePrimaryKey()
        }

        this.data.set(payload[this.entityMetadata.primaryKey!], payload as InferDetail<TSchema>)
        return payload as InferDetail<TSchema>
    }

    async update(lookup: InferLookup<TSchema>, input: InferInput<TSchema>): Promise<InferDetail<TSchema>> {
        if (!this.entityMetadata?.primaryKey) {
            throw new Error('Primary key is not defined in the schema metadata')
        }
        const primaryKeyValue = lookup[this.entityMetadata.primaryKey]
        if (!primaryKeyValue) {
            throw new Error('Primary key value must be provided')
        }

        const existingItem = this.data.get(primaryKeyValue)
        if (!existingItem) {
            throw new Error('Item not found')
        }

        const updatedItem = Object.assign({}, existingItem, input) as InferDetail<TSchema>
        this.data.set(primaryKeyValue, updatedItem)
        return updatedItem
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
