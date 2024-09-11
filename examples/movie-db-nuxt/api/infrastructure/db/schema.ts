import { pgTable, serial, uniqueIndex, varchar } from 'drizzle-orm/pg-core'

export const users = pgTable(
    'users',
    {
        id: serial('id').primaryKey().notNull(),
        name: varchar('name', { length: 256 }),
        email: varchar('email', { length: 256 }),
    },
    (table) => {
        return {
            email_idx: uniqueIndex('email_idx').using('btree', table.email),
        }
    },
)
