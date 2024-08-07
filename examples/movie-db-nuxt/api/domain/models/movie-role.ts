import { integer, pgEnum, pgTable, uniqueIndex } from 'drizzle-orm/pg-core'
import { movies } from './movie'
import { people } from './person'
import { generateSchema } from '@declaro/db-drizzle'

export const movieRoleType = pgEnum('movie_role_type', ['ACTOR', 'DIRECTOR', 'PRODUCER', 'OTHER'])

// MovieRoles table (a many to many relationship between movies and people)

export const movieRoles = pgTable(
    'movie_roles',
    {
        movieId: integer('movie_id')
            .references(() => movies.id)
            .notNull(),
        personId: integer('person_id')
            .references(() => people.id)
            .notNull(),
        role: movieRoleType('role').notNull(),
    },
    (table) => {
        return {
            // Composite unique constraint on movieId and personId
            movie_person_idx: uniqueIndex('movie_person_idx').using('btree', table.movieId, table.personId),
        }
    },
)

export const movieRoleSchema = generateSchema(movieRoles)
