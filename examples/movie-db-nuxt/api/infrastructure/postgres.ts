import postgres from 'postgres'
import { DbConnectionInfo } from '~/api/domain/interfaces/db'

export async function createDbConnection(connectionDetails: DbConnectionInfo) {
    const client = postgres({
        user: connectionDetails.user,
        host: connectionDetails.host,
        database: connectionDetails.database,
        password: connectionDetails.password,
        port: connectionDetails.port,
        max: connectionDetails.maxConnections,
    })

    return client
}
