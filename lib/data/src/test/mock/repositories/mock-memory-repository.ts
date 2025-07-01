import type { ModelSchema } from '@declaro/core'
import type { IRepository } from '../../../domain/interfaces/repository'
import type {
    InferDetail,
    InferFilters,
    InferInput,
    InferSummary,
    InferLookup,
    InferSearchResults,
} from '../../../shared/utils/schema-inference'
import type { IPaginationInput } from '../../../domain/models/pagination'

export interface IMockMemoryRepositoryArgs<TSchema extends ModelSchema> {
    primaryKey: string
    schema: TSchema
}

export class MockMemoryRepository<TSchema extends ModelSchema> implements IRepository<TSchema> {
    protected data = new Map<string, InferDetail<TSchema>>()
    protected trash = new Map<string, InferDetail<TSchema>>()

    constructor(protected args: IMockMemoryRepositoryArgs<TSchema>) {
        if (!args.primaryKey) {
            throw new Error('Primary key must be specified for MockMemoryRepository')
        }
    }

    async load(input: InferLookup<TSchema>): Promise<InferDetail<TSchema>> {
        const item = await this.data.get(input[this.args.primaryKey])
        if (!item) {
            throw new Error('Item not found')
        }

        return item
    }
    async loadMany(inputs: InferLookup<TSchema>[]): Promise<InferDetail<TSchema>[]> {
        const items = await Promise.all(inputs.map((input) => this.data.get(input[this.args.primaryKey])))
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
        const item = await this.data.get(lookup[this.args.primaryKey])
        if (!item) {
            throw new Error('Item not found')
        }
        // Move the item to trash
        this.trash.set(lookup[this.args.primaryKey], item)
        // Remove the item from data
        this.data.delete(lookup[this.args.primaryKey])
        return item
    }
    async restore(lookup: InferLookup<TSchema>): Promise<InferSummary<TSchema>> {
        const item = await this.trash.get(lookup[this.args.primaryKey])
        if (!item) {
            throw new Error('Item not found in trash')
        }
        this.trash.delete(lookup[this.args.primaryKey])
        this.data.set(lookup[this.args.primaryKey], item)
        return item
    }

    async create(input: InferInput<TSchema>): Promise<InferDetail<TSchema>> {
        const primaryKeyValue = input[this.args.primaryKey]
        if (!primaryKeyValue) {
            throw new Error('Primary key value must be provided')
        }

        if (this.data.has(primaryKeyValue)) {
            throw new Error('Item with the same primary key already exists')
        }

        this.data.set(primaryKeyValue, input as InferDetail<TSchema>)
        return input as InferDetail<TSchema>
    }

    async update(lookup: InferLookup<TSchema>, input: InferInput<TSchema>): Promise<InferDetail<TSchema>> {
        const primaryKeyValue = lookup[this.args.primaryKey]
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
}
