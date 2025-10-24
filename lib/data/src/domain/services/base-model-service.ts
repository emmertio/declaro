import { ActionDescriptor, type AnyModelSchema, type ModelSchema } from '@declaro/core'
import type { IModelServiceArgs } from './model-service-args'
import type { IRepository } from '../interfaces/repository'
import type {
    InferEntityMetadata,
    InferInput,
    InferLookup,
    InferPrimaryKeyType,
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
}
