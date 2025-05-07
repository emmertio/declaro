import { defineModel } from '@declaro/core'
import { getTableName } from 'drizzle-orm'
import { pgTable } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import { Pg } from './adapters/pg'
import { drizzleTableInput } from './model'

describe('Drizzle Model', () => {
    // Declaro model
    const userModel = defineModel('User', {
        type: 'object',
        properties: {
            id: {
                type: 'number',
            },
            displayName: {
                type: 'string',
            },
            email: {
                type: 'string',
                format: 'email',
                minimum: 4,
            },
            bio: {
                type: 'string',
                format: 'text',
            },
            password: {
                type: 'string',
            },
            active: {
                type: 'boolean',
                default: false,
            },
        },
        required: ['id', 'displayName', 'email', 'password'],
    })

    it('Should be able to generate input for a drizzle table from a declaro model', async () => {
        // Generate drizzle table input
        const userSchema = drizzleTableInput(userModel, Pg.map)
        const userTable = pgTable('user', userSchema)

        expect(userSchema).toBeTypeOf('object')
        expect(userTable.id.dataType).toBe('number')
        expect(userTable.displayName.dataType).toBe('string')
        expect(userTable.email.dataType).toBe('string')
        expect(userTable.bio.dataType).toBe('string')
        expect(userTable.password.dataType).toBe('string')
        expect(userTable.active.dataType).toBe('boolean')

        // const userManualTable = pgTable('user', userSchema)

        // const explicitUser = pgTable('user', {
        //     id: serial('id'),
        //     firstName: varchar('first_name', { length: 255 }),
        //     lastName: varchar('last_name', { length: 255 }),
        //     displayName: varchar('display_name', { length: 255 }),
        //     email: varchar('email', { length: 255 }),
        //     bio: varchar('bio', { length: 255 }),
        //     password: varchar('password', { length: 255 }),
        //     active: boolean('active'),
        // })
        // const col = explicitUser.id

        // const test = {} as any as InferTableSchema<typeof userModel, typeof PgColumns>
        // const x = test.id
        // const y = {} as any as InferDefaultColumnConfig<typeof PgColumns, 'string'>

        // const w = pgTable('test', test)
        // w.id

        // const t = pgTable('test', test)
        // const t2 = drizzleTable(userModel, 'public', PgColumns)

        // const db = drizzle({} as any, {
        //     schema: {
        //         user: pgTable('user', userSchema),
        //         explicitUser,
        //     },
        // })

        // const u = await db.select().from(t)
        // const eu = await db.select().from(explicitUser)

        // expect(dbUser.name).toBe('user')
    })

    it('Should generate a table schema', () => {
        const userTable = Pg.table(userModel)
        const tableName = getTableName(userTable)

        expect(tableName).toBe('user')

        expect(userTable.id.dataType).toBe('number')
        expect(userTable.displayName.dataType).toBe('string')
        expect(userTable.email.dataType).toBe('string')
        expect(userTable.bio.dataType).toBe('string')
        expect(userTable.password.dataType).toBe('string')
        expect(userTable.active.dataType).toBe('boolean')
    })

    it('Should snake case table names', () => {
        const table1 = Pg.table({ ...userModel, name: 'Foo Bar' as const })
        const table2 = Pg.table({ ...userModel, name: 'FooBar' as const })
        const table3 = Pg.table({ ...userModel, name: 'fooBar' as const })
        const table4 = Pg.table({ ...userModel, name: 'foo_bar' as const })
        const table5 = Pg.table({ ...userModel, name: 'foo-bar' as const })
        const table6 = Pg.table({ ...userModel, name: 'foo bar' as const })
        const table7 = Pg.table({ ...userModel, name: 'FOO_BAR' as const })

        const table8 = Pg.table({ ...userModel, name: 'Foo8Bar' as const })
        const table9 = Pg.table({ ...userModel, name: 'foo89Bar' as const })

        expect(getTableName(table1)).toBe('foo_bar')
        expect(getTableName(table2)).toBe('foo_bar')
        expect(getTableName(table3)).toBe('foo_bar')
        expect(getTableName(table4)).toBe('foo_bar')
        expect(getTableName(table5)).toBe('foo_bar')
        expect(getTableName(table6)).toBe('foo_bar')
        expect(getTableName(table7)).toBe('foo_bar')

        expect(getTableName(table8)).toBe('foo_8_bar')
        expect(getTableName(table9)).toBe('foo_89_bar')
    })
})
