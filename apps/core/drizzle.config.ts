import { defineConfig } from 'drizzle-kit'
import { container } from './server/application/container'

const dbConfig = container.resolve('DbConnectionInfo')

export default defineConfig({
    dialect: 'postgresql',
    schema: ['./server/infrastructure/schema/*.ts', './server/**/schema/*.ts'],
    out: './server/infrastructure/migrations',
    dbCredentials: {
        user: dbConfig.user,
        host: dbConfig.host,
        database: dbConfig.database,
        password: dbConfig.password,
        port: dbConfig.port,
        ssl: false,
    },
})
