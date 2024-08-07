// People table

import { generateSchema } from '@declaro/db-drizzle'
import { SQL, sql } from 'drizzle-orm'
import { integer, pgEnum, pgTable, serial, uniqueIndex, varchar } from 'drizzle-orm/pg-core'

export const nameOrder = pgEnum('name_order', ['FAMILY_FIRST', 'FAMILY_LAST'])

export const people = pgTable(
    'people',
    {
        id: serial('id').primaryKey().notNull(),
        givenName: varchar('given_name', { length: 255 }),
        familyName: varchar('family_name', { length: 255 }),
        nameOrder: nameOrder('name_order'),
        displayName: varchar('display_name', { length: 255 }).generatedAlwaysAs(
            (): SQL =>
                sql`CASE WHEN name_order = 'FAMILY_FIRST' THEN ${people.familyName} || ' ' || ${people.givenName} ELSE ${people.givenName} || ' ' || ${people.familyName} END`,
        ),
        birthYear: integer('birth_year'),
    },
    (table) => {
        return {
            //Index on displayName
            display_name_idx: uniqueIndex('display_name_idx').using('btree', table.displayName),
        }
    },
)

export const personSchema = generateSchema(people, {
    givenName: (schema) =>
        schema.openapi({
            description: "The person's given name",
        }),
})
