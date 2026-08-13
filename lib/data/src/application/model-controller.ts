import type { AuthValidator } from '@declaro/auth'
import { PermissionValidator, type AnyModelSchema, type IAnyModel } from '@declaro/core'
import type { ModelService, ICreateOptions, IUpdateOptions } from '../domain/services/model-service'
import type { ILoadOptions } from '../domain/services/read-only-model-service'
import type {
    InferDetail,
    InferFilters,
    InferInput,
    InferInputFragment,
    InferLookup,
    InferSummary,
} from '../shared/utils/schema-inference'
import { ReadOnlyModelController } from './read-only-model-controller'

export class ModelController<TSchema extends AnyModelSchema> extends ReadOnlyModelController<TSchema> {
    constructor(
        protected readonly service: ModelService<TSchema>,
        protected readonly authValidator: AuthValidator,
    ) {
        super(service, authValidator)
    }

    /**
     * The model a fragment is validated against: the input model with every field optional.
     *
     * A fragment is valid when the fields it carries are valid, so a client can change one field
     * without resending the record. When the input model cannot describe a partial of itself,
     * this falls back to the full input model, which restores whole-payload validation rather
     * than letting anything through unchecked.
     */
    protected get inputFragmentModel(): IAnyModel | undefined {
        return this.inputModel?.partial() ?? this.inputModel
    }

    /**
     * Validates and sanitizes a payload arriving from outside the service.
     *
     * Fields marked `private: true` on the input model are removed, so a client cannot write to a
     * field the service owns, such as a computed value. Values are also coerced to the types the
     * model declares.
     *
     * Override to add custom input handling.
     *
     * @param input The payload to parse.
     * @returns The parsed payload.
     * @throws ValidationError When the payload does not satisfy the input model.
     */
    protected async parseInput(input: InferInput<TSchema>): Promise<InferInput<TSchema>> {
        if (!input || !this.inputModel) {
            return input
        }

        const result = await this.inputModel.validate(input)

        return 'value' in result ? (result.value as InferInput<TSchema>) : input
    }

    /**
     * Validates and sanitizes a list of whole payloads arriving from outside the service.
     *
     * `bulkUpsert` no longer uses this: it holds each payload to the rules of the operation it
     * will perform, via `parseUpsertInputs`. This remains for custom endpoints that take a list
     * of complete inputs, such as a bulk create.
     *
     * @param inputs The payloads to parse.
     * @returns The parsed payloads.
     */
    protected async parseInputs(inputs: InferInput<TSchema>[]): Promise<InferInput<TSchema>[]> {
        return Promise.all((inputs ?? []).map((input) => this.parseInput(input)))
    }

    /**
     * Validates and sanitizes a fragment arriving from outside the service.
     *
     * Each field the fragment carries is held to the input model's rules — a bad value or a wrong
     * type is rejected — but fields it leaves out are simply not being changed, so nothing is
     * required. Private fields are removed and values are coerced, exactly as `parseInput` does
     * for whole payloads.
     *
     * Override to add custom fragment handling.
     *
     * @param input The fragment to parse.
     * @returns The parsed fragment.
     * @throws ValidationError When a field the fragment carries does not satisfy the input model.
     */
    protected async parseInputFragment(input: InferInputFragment<TSchema>): Promise<InferInputFragment<TSchema>> {
        if (!input || !this.inputFragmentModel) {
            return input
        }

        const result = await this.inputFragmentModel.validate(input)

        return 'value' in result ? (result.value as InferInputFragment<TSchema>) : input
    }

    /**
     * Validates an upsert payload, whose rules depend on what the payload addresses.
     *
     * A payload addressing a record that exists is an update, so a fragment is enough. A payload
     * whose primary key is absent or unknown will create a record, and a created record has no
     * existing fields to fall back on, so the whole input is required.
     *
     * @param input The payload to parse.
     * @returns The parsed payload.
     * @throws ValidationError When the payload does not satisfy the rules of the operation it
     * will perform.
     */
    protected async parseUpsertInput(input: InferInputFragment<TSchema>): Promise<InferInputFragment<TSchema>> {
        const existing = await this.loadExistingForUpsert(input)

        return existing ? this.parseInputFragment(input) : this.parseInput(input as InferInput<TSchema>)
    }

    /**
     * Validates a list of upsert payloads, holding each one to the rules of the operation it
     * will perform. See `parseUpsertInput`.
     * @param inputs The payloads to parse.
     * @returns The parsed payloads.
     */
    protected async parseUpsertInputs(inputs: InferInputFragment<TSchema>[]): Promise<InferInputFragment<TSchema>[]> {
        return Promise.all((inputs ?? []).map((input) => this.parseUpsertInput(input)))
    }

    /**
     * Finds the record an upsert payload addresses, if there is one.
     * @param input The upsert payload.
     * @returns The existing record, or undefined when the payload will create one.
     */
    protected async loadExistingForUpsert(
        input: InferInputFragment<TSchema>,
    ): Promise<InferDetail<TSchema> | undefined> {
        const primaryKey = this.service.getSchema()?.getEntityMetadata()?.primaryKey
        if (!primaryKey || !input) {
            return undefined
        }

        const primaryKeyValue = (input as Record<string, unknown>)[primaryKey]
        if (primaryKeyValue === undefined) {
            return undefined
        }

        return this.service.load({ [primaryKey]: primaryKeyValue } as InferLookup<TSchema>, {
            doNotDispatchEvents: true,
        })
    }

    async createPermissions(input: InferInput<TSchema>, options?: ICreateOptions): Promise<PermissionValidator> {
        return PermissionValidator.create().someOf([
            this.service.getDescriptor('create', '*').toString(),
            this.service.getDescriptor('write', '*').toString(),
        ])
    }

    async create(input: InferInput<TSchema>, options?: ICreateOptions): Promise<InferDetail<TSchema>> {
        const permissions = await this.createPermissions(input, options)
        this.authValidator.validatePermissions((v) => v.extend(permissions))

        return this.serializeDetail(await this.service.create(await this.parseInput(input), options))
    }

    async updatePermissions(
        lookup: InferLookup<TSchema>,
        input: InferInputFragment<TSchema>,
        options?: IUpdateOptions,
    ): Promise<PermissionValidator> {
        return PermissionValidator.create().someOf([
            this.service.getDescriptor('update', '*').toString(),
            this.service.getDescriptor('write', '*').toString(),
        ])
    }

    /**
     * Updates a record. The input may be a fragment carrying only the fields being changed;
     * each field it carries is validated, and fields it leaves out keep their current value.
     * @param lookup The lookup criteria to find the record.
     * @param input The fields to change.
     * @param options Optional update options.
     * @returns The updated record.
     */
    async update(
        lookup: InferLookup<TSchema>,
        input: InferInputFragment<TSchema>,
        options?: IUpdateOptions,
    ): Promise<InferDetail<TSchema>> {
        const permissions = await this.updatePermissions(lookup, input, options)
        this.authValidator.validatePermissions((v) => v.extend(permissions))

        return this.serializeDetail(await this.service.update(lookup, await this.parseInputFragment(input), options))
    }

    async removePermissions(lookup: InferLookup<TSchema>, options?: ILoadOptions): Promise<PermissionValidator> {
        return PermissionValidator.create().someOf([
            this.service.getDescriptor('remove', '*').toString(),
            this.service.getDescriptor('write', '*').toString(),
        ])
    }

    async remove(lookup: InferLookup<TSchema>, options?: ILoadOptions): Promise<InferSummary<TSchema>> {
        const permissions = await this.removePermissions(lookup, options)
        this.authValidator.validatePermissions((v) => v.extend(permissions))

        return this.serializeSummary(await this.service.remove(lookup, options))
    }

    async restorePermissions(lookup: InferLookup<TSchema>, options?: ILoadOptions): Promise<PermissionValidator> {
        return PermissionValidator.create().someOf([
            this.service.getDescriptor('restore', '*').toString(),
            this.service.getDescriptor('write', '*').toString(),
        ])
    }

    async restore(lookup: InferLookup<TSchema>, options?: ILoadOptions): Promise<InferSummary<TSchema>> {
        const permissions = await this.restorePermissions(lookup, options)
        this.authValidator.validatePermissions((v) => v.extend(permissions))

        return this.serializeSummary(await this.service.restore(lookup, options))
    }

    async upsertPermissions(
        input: InferInputFragment<TSchema>,
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
     *
     * A payload addressing an existing record may be a fragment carrying only the fields being
     * changed. A payload that will create a record must be the whole valid input, since a new
     * record has no existing fields to fall back on.
     *
     * @param input The input data for the upsert operation.
     * @param options Optional create or update options.
     * @returns The upserted record.
     */
    async upsert(
        input: InferInputFragment<TSchema>,
        options?: ICreateOptions | IUpdateOptions,
    ): Promise<InferDetail<TSchema>> {
        const permissions = await this.upsertPermissions(input, options)
        this.authValidator.validatePermissions((v) => v.extend(permissions))

        return this.serializeDetail(await this.service.upsert(await this.parseUpsertInput(input), options))
    }

    async bulkUpsertPermissions(
        inputs: InferInputFragment<TSchema>[],
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
     *
     * Each payload is held to the rules of the operation it will perform: a fragment is enough
     * for one addressing an existing record, while one that will create a record must be the
     * whole valid input.
     *
     * @param inputs Array of input data for the bulk upsert operation.
     * @param options Optional create or update options.
     * @returns Array of upserted records.
     */
    async bulkUpsert(
        inputs: InferInputFragment<TSchema>[],
        options?: ICreateOptions | IUpdateOptions,
    ): Promise<InferDetail<TSchema>[]> {
        const permissions = await this.bulkUpsertPermissions(inputs, options)
        this.authValidator.validatePermissions((v) => v.extend(permissions))

        return this.serializeDetails(await this.service.bulkUpsert(await this.parseUpsertInputs(inputs), options))
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

        return this.serializeSummary(await this.service.permanentlyDeleteFromTrash(lookup))
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

        return this.serializeSummary(await this.service.permanentlyDelete(lookup))
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
