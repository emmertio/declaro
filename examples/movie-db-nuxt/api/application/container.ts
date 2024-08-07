import { Container } from '@declaro/di'
import pkg from '../../package.json'
import { DbConnectionInfo } from '../domain/interfaces/db'
import { movieSchema } from '../domain/models/movie'
import { movieRoleSchema } from '../domain/models/movie-role'
import { createDrizzle } from '../infrastructure/drizzle'
import { createDbConnection } from '../infrastructure/postgres'
import { documentationContainer } from '../modules/documentation/container'
import { personContainer } from '../modules/person/container'
import { registerSchemas } from './schema'

export const container = new Container()
    .merge(documentationContainer)
    .merge(personContainer)
    .provideValue('OpenAPIAppDescription', {
        openapi: '3.0.1',
        info: {
            title: 'Movie Database',
            description: 'A simple movie database',
            version: pkg.version,
        },
    })
    .provideValue('DbConnectionInfo', <DbConnectionInfo>{
        user: 'app',
        host: 'localhost',
        database: 'app',
        password: 'sa',
        port: 5432,
    })
    .provideAsyncFactory('DbConnection', createDbConnection, ['DbConnectionInfo'])
    .provideAsyncFactory('Drizzle', createDrizzle, ['DbConnection'])
    .middleware('OpenAPIRegistry', registerSchemas(movieSchema, movieRoleSchema))
