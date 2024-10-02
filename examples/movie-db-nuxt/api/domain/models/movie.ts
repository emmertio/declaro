import { date, integer, pgEnum, pgTable, serial, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core'
import { people } from '../../modules/person/models/person'
import { generateSchema } from '@declaro/db-drizzle'

// Movies table
export const movies = pgTable(
    'movies',
    {
        id: serial('id').primaryKey().notNull(),
        title: varchar('title', { length: 255 }),
        description: text('description'),
        releaseDate: date('release_date'),
    },
    (table) => {
        return {
            // Composite unique constraint on title and releaseDate
            title_release_date_idx: uniqueIndex('title_release_date_idx').using(
                'btree',
                table.title,
                table.releaseDate,
            ),
        }
    },
)

export const movieSchema = generateSchema(movies)
