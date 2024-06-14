import { Container } from '@declaro/di'
import { DbConnectionInfo } from '../domain/interfaces/db'
import { createDrizzle } from '../infrastructure/drizzle'
import { createDbConnection } from '../infrastructure/postgres'

export const container = new Container()
    .provideValue('DbConnectionInfo', <DbConnectionInfo>{
        user: 'app',
        host: 'localhost',
        database: 'app',
        password: 'sa',
        port: 5432,
    })
    .provideFactory(
        'DbMigrationConnectionInfo',
        (info: DbConnectionInfo) => {
            return {
                ...info,
                maxConnections: 1,
            }
        },
        ['DbConnectionInfo'],
    )
    .provideAsyncFactory('DbConnection', createDbConnection, ['DbConnectionInfo'])
    .provideAsyncFactory('DbMigrationConnection', createDbConnection, ['DbMigrationConnectionInfo'])
    .provideAsyncFactory('Drizzle', createDrizzle, ['DbConnection'])
    .provideAsyncFactory('MigrationDrizzle', createDrizzle, ['DbMigrationConnection'])
