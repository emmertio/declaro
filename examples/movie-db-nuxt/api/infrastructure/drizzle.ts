import { DrizzleConfig } from 'drizzle-orm'
import { DbConnection } from '../domain/interfaces/db'
import { drizzle } from 'drizzle-orm/postgres-js'

export async function createDrizzle(connection: DbConnection) {
    return drizzle(connection)
}
