import { defineConfig } from 'drizzle-kit'
import { container } from './api/application/container'

const dbConfig = container.resolve('DbConnectionInfo')

export default defineConfig({
    dialect: 'postgresql',
    schema: [
        './server/infrastructure/db/schema.ts',
        './server/infrastructure/db/schema/*.ts',
        './server/domain/models/*.ts',
        './server/domain/**/models/*.ts',
        './server/**/*.model.ts',
    ],
    out: './server/infrastructure/db',
    dbCredentials: {
        user: dbConfig.user,
        host: dbConfig.host,
        database: dbConfig.database,
        password: dbConfig.password,
        port: dbConfig.port,
        ssl: false,
    },
})
