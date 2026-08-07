import { ActionDescriptor, wrapModel, type AnyModelSchema, type IAnyModel, type WrapModelOptions } from '@declaro/core'
import type { IModelServiceArgs } from './model-service-args'
import type { IRepository } from '../interfaces/repository'
import type {
    InferDetail,
    InferEntityMetadata,
    InferInput,
    InferLookup,
    InferPrimaryKeyType,
    InferSummary,
} from '../../shared/utils/schema-inference'

export interface IActionOptions {
    /**
     * The scope of the load operation, e.g., 'detail', 'list', etc.
     */
    scope?: string
}

export class BaseModelService<TSchema extends AnyModelSchema> {
    protected readonly namespace: string
    protected readonly schema: TSchema
    protected readonly entityMetadata: InferEntityMetadata<TSchema>
    protected readonly emitter: IModelServiceArgs<TSchema>['emitter']
    protected readonly repository: IRepository<TSchema>

    constructor(args: IModelServiceArgs<TSchema>) {
        this.schema = args.schema
        this.namespace = args.namespace ?? 'global'
        this.emitter = args.emitter
        this.repository = args.repository
        this.entityMetadata = this.schema.getEntityMetadata()
    }

    getDescriptor(action: string, scope?: string) {
        return ActionDescriptor.fromJSON({
            namespace: this.namespace,
            resource: this.schema.name,
            action,
            scope,
        })
    }

    getPrimaryKeyValue(input: InferLookup<TSchema>): InferPrimaryKeyType<TSchema>
    getPrimaryKeyValue(input: InferInput<TSchema>): InferPrimaryKeyType<TSchema>
    getPrimaryKeyValue(input: any = {}): InferPrimaryKeyType<TSchema> {
        if (!this.entityMetadata?.primaryKey) {
            return undefined
        }
        return input[this.entityMetadata.primaryKey]
    }

    public getSchema() {
        return this.schema
    }

    /**
     * The settings applied when this service wraps the records it returns.
     *
     * Override to change how a service's records serialize, for example to skip validation on a
     * hot path. Records are stripped of their private fields by default.
     *
     * @returns The wrap settings for this service.
     */
    protected get wrapOptions(): WrapModelOptions {
        return {}
    }

    /**
     * Wraps a record so that serializing it applies the given model's rules.
     * @param model The model describing the record, if the schema defines one.
     * @param value The record to wrap.
     * @returns The wrapped record, or the record unchanged when there is no model.
     */
    private wrapWith<TValue>(model: IAnyModel | undefined, value: TValue): TValue {
        return model && value ? wrapModel(model, value, this.wrapOptions) : value
    }

    /**
     * Wraps a detail record so that private fields are stripped when it is serialized.
     *
     * Reading properties directly is unaffected, so the service layer still sees every field.
     *
     * @param value The record to wrap.
     * @returns The wrapped record.
     */
    protected wrapDetail(value: InferDetail<TSchema>): InferDetail<TSchema> {
        return this.wrapWith(this.schema?.definition?.detail, value)
    }

    /**
     * Wraps a list of detail records so that private fields are stripped when they are serialized.
     * @param values The records to wrap.
     * @returns The wrapped records.
     */
    protected wrapDetails(values: InferDetail<TSchema>[]): InferDetail<TSchema>[] {
        return values.map((value) => this.wrapDetail(value))
    }

    /**
     * Wraps a summary record so that private fields are stripped when it is serialized.
     * @param value The record to wrap.
     * @returns The wrapped record.
     */
    protected wrapSummary(value: InferSummary<TSchema>): InferSummary<TSchema> {
        return this.wrapWith(this.schema?.definition?.summary, value)
    }

    /**
     * Wraps a list of summary records so that private fields are stripped when they are serialized.
     * @param values The records to wrap.
     * @returns The wrapped records.
     */
    protected wrapSummaries(values: InferSummary<TSchema>[]): InferSummary<TSchema>[] {
        return values.map((value) => this.wrapSummary(value))
    }
}
