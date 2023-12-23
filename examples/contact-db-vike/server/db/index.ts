import { MikroORM } from '@mikro-orm/core'
import { PostgreSqlDriver } from '@mikro-orm/postgresql'
import { BaseModel } from './models/BaseModel'
import { makeInjectorMiddleware } from '@declaro/core'
import { IDatabaseDriver } from '@mikro-orm/core/drivers'
import { Configuration, Options } from '@mikro-orm/core/utils'
import { ConnectionDetails, DbContext, IDBContext } from './utils/DbConfig'
import { Injector, TChildContext, createInjector } from 'typed-inject'

const test = createInjector().provideValue('test', 4)

export const Db = {
    Orm: 'Db.ORM',
    EntityManager: 'Db.EntityManager',
    Context: 'IDBContext',
}

export async function connectDb(dbContext: IDBContext) {
    const config = dbContext.getConfig()

    const envPort = !!process.env.DB_PORT
        ? parseInt(process.env.DB_PORT)
        : undefined

    return await MikroORM.init<PostgreSqlDriver>({
        entities: config.models,
        dbName: process.env.DB_NAME ?? config.connection?.dbName ?? 'app',
        type: 'postgresql',
        user: process.env.DB_USER ?? config.connection?.user ?? 'app',
        password: process.env.DB_PASS ?? config.connection?.pass ?? 'sa',
        host: process.env.DB_HOST ?? config.connection?.host ?? 'localhost',
        port: envPort ?? config.connection?.port ?? 5432,
    })
}

export const dbConfig = makeInjectorMiddleware(
    async (injector, connectionDetails: ConnectionDetails) => {
        const context = new DbContext(connectionDetails)

        context.addModel(BaseModel)

        return injector.provideValue(Db.Context, context)
    },
)

export const provideDbDeps = makeInjectorMiddleware(async (injector) => {
    const dbContext: IDBContext = injector.resolve(Db.Context)
    const db = await connectDb(dbContext)

    function emFactory(orm: MikroORM<PostgreSqlDriver>) {
        return orm.em
    }

    emFactory.inject = [Db.Orm] as const

    return injector
        .provideValue(Db.Orm, db)
        .provideFactory(Db.EntityManager, emFactory)
})
