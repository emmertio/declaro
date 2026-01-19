import type { AuthValidator } from '@declaro/auth'
import { PermissionValidator, type AnyModelSchema } from '@declaro/core'
import type { ModelService, ICreateOptions, IUpdateOptions } from '../domain/services/model-service'
import type { InferDetail, InferFilters, InferInput, InferLookup, InferSummary } from '../shared/utils/schema-inference'
import { ReadOnlyModelController } from './read-only-model-controller'

export class ModelController<TSchema extends AnyModelSchema> extends ReadOnlyModelController<TSchema> {
    constructor(
        protected readonly service: ModelService<TSchema>,
        protected readonly authValidator: AuthValidator,
    ) {
        super(service, authValidator)
    }

    async createPermissions(input: InferInput<TSchema>): Promise<PermissionValidator> {
        return PermissionValidator.create().someOf([
            this.service.getDescriptor('create', '*').toString(),
            this.service.getDescriptor('write', '*').toString(),
        ])
    }

    async create(input: InferInput<TSchema>): Promise<InferDetail<TSchema>> {
        const permissions = await this.createPermissions(input)
        this.authValidator.validatePermissions((v) => v.extend(permissions))
        return this.service.create(input)
    }

    async updatePermissions(lookup: InferLookup<TSchema>, input: InferInput<TSchema>): Promise<PermissionValidator> {
        return PermissionValidator.create().someOf([
            this.service.getDescriptor('update', '*').toString(),
            this.service.getDescriptor('write', '*').toString(),
        ])
    }

    async update(lookup: InferLookup<TSchema>, input: InferInput<TSchema>): Promise<InferDetail<TSchema>> {
        const permissions = await this.updatePermissions(lookup, input)
        this.authValidator.validatePermissions((v) => v.extend(permissions))
        return this.service.update(lookup, input)
    }

    async removePermissions(lookup: InferLookup<TSchema>): Promise<PermissionValidator> {
        return PermissionValidator.create().someOf([
            this.service.getDescriptor('remove', '*').toString(),
            this.service.getDescriptor('write', '*').toString(),
        ])
    }

    async remove(lookup: InferLookup<TSchema>): Promise<InferSummary<TSchema>> {
        const permissions = await this.removePermissions(lookup)
        this.authValidator.validatePermissions((v) => v.extend(permissions))
        return this.service.remove(lookup)
    }

    async restorePermissions(lookup: InferLookup<TSchema>): Promise<PermissionValidator> {
        return PermissionValidator.create().someOf([
            this.service.getDescriptor('restore', '*').toString(),
            this.service.getDescriptor('write', '*').toString(),
        ])
    }

    async restore(lookup: InferLookup<TSchema>): Promise<InferSummary<TSchema>> {
        const permissions = await this.restorePermissions(lookup)
        this.authValidator.validatePermissions((v) => v.extend(permissions))
        return this.service.restore(lookup)
    }

    async upsertPermissions(
        input: InferInput<TSchema>,
        options?: ICreateOptions | IUpdateOptions,
    ): Promise<PermissionValidator> {
        // Create nested validator for (create AND update) permissions
        const createAndUpdateValidator = PermissionValidator.create().allOf([
            this.service.getDescriptor('create', '*').toString(),
            this.service.getDescriptor('update', '*').toString(),
        ])

        return PermissionValidator.create().someOf([
            createAndUpdateValidator,
            this.service.getDescriptor('write', '*').toString(),
        ])
    }

    /**
     * Upserts a record (creates if it doesn't exist, updates if it does).
     * @param input The input data for the upsert operation.
     * @param options Optional create or update options.
     * @returns The upserted record.
     */
    async upsert(input: InferInput<TSchema>, options?: ICreateOptions | IUpdateOptions): Promise<InferDetail<TSchema>> {
        const permissions = await this.upsertPermissions(input, options)
        this.authValidator.validatePermissions((v) => v.extend(permissions))
        return this.service.upsert(input, options)
    }

    async bulkUpsertPermissions(
        inputs: InferInput<TSchema>[],
        options?: ICreateOptions | IUpdateOptions,
    ): Promise<PermissionValidator> {
        // Create nested validator for (create AND update) permissions
        const createAndUpdateValidator = PermissionValidator.create().allOf([
            this.service.getDescriptor('create', '*').toString(),
            this.service.getDescriptor('update', '*').toString(),
        ])

        return PermissionValidator.create().someOf([
            createAndUpdateValidator,
            this.service.getDescriptor('write', '*').toString(),
        ])
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
        const permissions = await this.bulkUpsertPermissions(inputs, options)
        this.authValidator.validatePermissions((v) => v.extend(permissions))
        return this.service.bulkUpsert(inputs, options)
    }

    async permanentlyDeleteFromTrashPermissions(lookup: InferLookup<TSchema>): Promise<PermissionValidator> {
        return PermissionValidator.create().someOf([
            this.service.getDescriptor('permanently-delete-from-trash', '*').toString(),
            this.service.getDescriptor('permanently-delete', '*').toString(),
            this.service.getDescriptor('empty-trash', '*').toString(),
        ])
    }

    /**
     * Permanently deletes a specific entity from the trash.
     * Requires 'permanently-delete-from-trash', 'permanently-delete', or 'empty-trash' permission.
     * @param lookup The lookup object containing entity identifiers
     * @returns The permanently deleted entity summary
     */
    async permanentlyDeleteFromTrash(lookup: InferLookup<TSchema>): Promise<InferSummary<TSchema>> {
        const permissions = await this.permanentlyDeleteFromTrashPermissions(lookup)
        this.authValidator.validatePermissions((v) => v.extend(permissions))
        return this.service.permanentlyDeleteFromTrash(lookup)
    }

    async permanentlyDeletePermissions(lookup: InferLookup<TSchema>): Promise<PermissionValidator> {
        return PermissionValidator.create().someOf([this.service.getDescriptor('permanently-delete', '*').toString()])
    }

    /**
     * Permanently deletes an entity without moving it to trash first.
     * Requires 'permanently-delete' permission.
     * @param lookup The lookup object containing entity identifiers
     * @returns The permanently deleted entity summary
     */
    async permanentlyDelete(lookup: InferLookup<TSchema>): Promise<InferSummary<TSchema>> {
        const permissions = await this.permanentlyDeletePermissions(lookup)
        this.authValidator.validatePermissions((v) => v.extend(permissions))
        return this.service.permanentlyDelete(lookup)
    }

    async emptyTrashPermissions(filters?: InferFilters<TSchema>): Promise<PermissionValidator> {
        return PermissionValidator.create().someOf([this.service.getDescriptor('empty-trash', '*').toString()])
    }

    /**
     * Empties the trash by permanently deleting entities that have been marked as removed.
     * Requires 'empty-trash' permission.
     * @param filters Optional filters to apply when selecting entities to delete
     * @returns The count of entities permanently deleted
     */
    async emptyTrash(filters?: InferFilters<TSchema>): Promise<number> {
        const permissions = await this.emptyTrashPermissions(filters)
        this.authValidator.validatePermissions((v) => v.extend(permissions))
        return this.service.emptyTrash(filters)
    }
}
