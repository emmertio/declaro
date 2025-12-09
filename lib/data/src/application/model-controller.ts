import type { AuthValidator } from '@declaro/auth'
import { PermissionValidator, type AnyModelSchema } from '@declaro/core'
import type { ModelService, ICreateOptions, IUpdateOptions } from '../domain/services/model-service'
import type { InferDetail, InferFilters, InferInput, InferLookup, InferSummary } from '../shared/utils/schema-inference'
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

    /**
     * Upserts a record (creates if it doesn't exist, updates if it does).
     * @param input The input data for the upsert operation.
     * @param options Optional create or update options.
     * @returns The upserted record.
     */
    async upsert(input: InferInput<TSchema>, options?: ICreateOptions | IUpdateOptions): Promise<InferDetail<TSchema>> {
        // Create nested validator for (create AND update) permissions
        const createAndUpdateValidator = PermissionValidator.create().allOf([
            this.service.getDescriptor('create', '*').toString(),
            this.service.getDescriptor('update', '*').toString(),
        ])

        this.authValidator.validatePermissions((v) =>
            v.someOf([createAndUpdateValidator, this.service.getDescriptor('write', '*').toString()]),
        )
        return this.service.upsert(input, options)
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
        // Create nested validator for (create AND update) permissions
        const createAndUpdateValidator = PermissionValidator.create().allOf([
            this.service.getDescriptor('create', '*').toString(),
            this.service.getDescriptor('update', '*').toString(),
        ])

        this.authValidator.validatePermissions((v) =>
            v.someOf([createAndUpdateValidator, this.service.getDescriptor('write', '*').toString()]),
        )
        return this.service.bulkUpsert(inputs, options)
    }

    /**
     * Permanently deletes a specific entity from the trash.
     * Requires 'permanently-delete-from-trash', 'permanently-delete', or 'empty-trash' permission.
     * @param lookup The lookup object containing entity identifiers
     * @returns The permanently deleted entity summary
     */
    async permanentlyDeleteFromTrash(lookup: InferLookup<TSchema>): Promise<InferSummary<TSchema>> {
        this.authValidator.validatePermissions((v) =>
            v.someOf([
                this.service.getDescriptor('permanently-delete-from-trash', '*').toString(),
                this.service.getDescriptor('permanently-delete', '*').toString(),
                this.service.getDescriptor('empty-trash', '*').toString(),
            ]),
        )
        return this.service.permanentlyDeleteFromTrash(lookup)
    }

    /**
     * Permanently deletes an entity without moving it to trash first.
     * Requires 'permanently-delete' permission.
     * @param lookup The lookup object containing entity identifiers
     * @returns The permanently deleted entity summary
     */
    async permanentlyDelete(lookup: InferLookup<TSchema>): Promise<InferSummary<TSchema>> {
        this.authValidator.validatePermissions((v) =>
            v.someOf([this.service.getDescriptor('permanently-delete', '*').toString()]),
        )
        return this.service.permanentlyDelete(lookup)
    }

    /**
     * Empties the trash by permanently deleting entities that have been marked as removed.
     * Requires 'empty-trash' permission.
     * @param filters Optional filters to apply when selecting entities to delete
     * @returns The count of entities permanently deleted
     */
    async emptyTrash(filters?: InferFilters<TSchema>): Promise<number> {
        this.authValidator.validatePermissions((v) =>
            v.someOf([this.service.getDescriptor('empty-trash', '*').toString()]),
        )
        return this.service.emptyTrash(filters)
    }
}
