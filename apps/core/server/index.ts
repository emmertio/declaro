import express from 'express'
import { container } from './application/container'
import { eq } from 'drizzle-orm'
import { users as userSchema } from './infrastructure/schema/user'
import { asyncHandler } from './utils/express-utils'
import { migrate } from 'drizzle-orm/postgres-js/migrator'

async function onStart() {
    console.log('Server started')
    const db = await container.resolve('MigrationDrizzle')
    console.log('Migrating database')
    migrate(db, {
        migrationsFolder: './server/infrastructure/migrations',
    })
    console.log('Database migrated')
}
onStart()

const app = express()

app.use((req, res, next) => {
    next()
})

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
    })
})

app.get(
    '/users',
    asyncHandler(async (req, res) => {
        const db = await container.resolve('Drizzle')
        const users = await db.select().from(userSchema).execute()
        res.status(200).json(users)
    }),
)

app.post('/users', async (req, res) => {
    const { name, email } = req.body
    const db = await container.resolve('Drizzle')
    const user = await db.insert(userSchema).values([{ name, email }])
    res.json(user)
})

app.put('/users/:id', async (req, res) => {
    const { id } = req.params
    const { name, email } = req.body
    const db = await container.resolve('Drizzle')
    const user = await db
        .update(userSchema)
        .set({ name, email })
        .where(eq(userSchema.id, Number(id)))
    res.json(user)
})

app.delete('/users/:id', async (req, res) => {
    const { id } = req.params
    const db = await container.resolve('Drizzle')
    const user = await db.delete(userSchema).where(eq(userSchema.id, Number(id)))
    res.json(user)
})

export default fromNodeMiddleware(app)
