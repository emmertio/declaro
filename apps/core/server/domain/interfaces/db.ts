import { Sql } from 'postgres'

export type DbConnectionInfo = {
    user: string
    host: string
    database: string
    password: string
    port: number
    maxConnections?: number
}

export type DbConnection = Sql
