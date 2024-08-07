import { Container } from '@declaro/di'
import pkg from '../../package.json'
import { MovieList } from '../domain/aggregates/movie-list'
import { DbConnectionInfo } from '../domain/interfaces/db'
import { createDrizzle } from '../infrastructure/drizzle'
import { createDbConnection } from '../infrastructure/postgres'
import { SampleMovieRepository } from '../infrastructure/sample-movie-repository'
import { documentationContainer } from '../modules/documentation/container'
import { createMovieRouter } from './routes'
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'
import { personSchema } from '../domain/models/person'
import { registerSchemas } from './schema'
import { movieSchema } from '../domain/models/movie'
import { movieRoleSchema } from '../domain/models/movie-role'

export const container = new Container()
    .merge(documentationContainer)
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
    .middleware('OpenAPIRegistry', registerSchemas(personSchema, movieSchema, movieRoleSchema))
    .provideClass('IMovieRepository', SampleMovieRepository)
    .provideClass('MovieList', MovieList, ['IMovieRepository'])
    .provideFactory('MovieRouter', createMovieRouter, ['MovieList'])
