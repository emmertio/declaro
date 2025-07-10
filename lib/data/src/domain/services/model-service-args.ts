import type { AnyModelSchema, EventManager } from '@declaro/core'
import type { IRepository } from '../interfaces/repository'

export interface IModelServiceArgs<TSchema extends AnyModelSchema> {
    schema: TSchema
    namespace?: string
    emitter: EventManager
    repository: IRepository<TSchema>
}
