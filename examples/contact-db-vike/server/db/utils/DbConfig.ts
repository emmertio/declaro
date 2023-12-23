import {
    AnyEntity,
    EntityClass,
    EntityClassGroup,
} from '@mikro-orm/core/typings'
import { EntitySchema } from '@mikro-orm/core/metadata/EntitySchema'

export type MikroORMModel =
    | string
    | EntityClass<AnyEntity>
    | EntityClassGroup<AnyEntity>
    | EntitySchema

export type Model = MikroORMModel
export type ConnectionDetails = {
    user: string
    pass: string
    host: string
    port: number
    dbName: string
}

export type DBConfig = {
    models: Model[]
    connection?: ConnectionDetails
}

export type IDBContext = {
    getConfig(): DBConfig
}

export class DbContext implements IDBContext {
    protected readonly models: Model[] = []
    protected connection?: ConnectionDetails

    constructor(connection: ConnectionDetails) {
        this.connection = connection
    }

    setConnection(connection: ConnectionDetails) {
        this.connection = connection
    }

    public addModel(...model: Model[]) {
        this.models.push(...model)
    }

    public getConfig(): DBConfig {
        return {
            models: this.models,
            connection: this.connection,
        }
    }
}
