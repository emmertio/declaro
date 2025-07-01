import type { EventManager, ModelSchema } from '@declaro/core'
import type { IRepository } from '../interfaces/repository'

export interface IModelServiceArgs<TSchema extends ModelSchema<any, any>> {
    schema: TSchema
    namespace?: string
    emitter: EventManager
    repository: IRepository<TSchema>
}
