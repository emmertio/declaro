import { pgTable, serial, uniqueIndex, varchar } from 'drizzle-orm/pg-core'

export const users = pgTable(
    'users',
    {
        id: serial('id').primaryKey(),
        name: varchar('name', { length: 256 }),
        email: varchar('email', { length: 256 }),
    },
    (users) => ({
        emailIndex: uniqueIndex('email_idx').on(users.email),
    }),
)

// export const users = pgTable(
//     'users',
//     {
//         id: serial('id').primaryKey(),
//         name: varchar('name', { length: 256 }),
//         email: varchar('email', { length: 256 }),
//     },
//     (users) => ({
//         emailIndex: uniqueIndex('email_idx').on(users.email),
//     }),
// )
