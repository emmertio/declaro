import type { Model, SnakeCase } from '@declaro/core'
import { splitSeparateNumbers } from 'change-case'
import { boolean, integer, jsonb, pgTable, real, varchar } from 'drizzle-orm/pg-core'
import { defineAdapter, type AnyColumnBuilderBase, type DrizzleMap } from '../map-builder'
import { drizzleTableInput, tableName } from '../model'

export const Pg = defineAdapter(
    {
        string: (args) => varchar(args.property.propertyName, { length: 255 }),
        boolean: (args) => boolean(args.property.propertyName),
        integer: (args) => integer(args.property.propertyName),
        number: (args) => real(args.property.propertyName),
        array: (args) => jsonb(args.property.propertyName),
        object: (args) => jsonb(args.property.propertyName),
        null: (args) => jsonb(args.property.propertyName).default(null),
    },
    (map) => {
        return {
            table: <TModel extends Model<any, string>>(model: TModel) => {
                const schema = drizzleTableInput(model, map)
                const name = tableName(model)
                const table = pgTable(name, schema)

                return table
            },
        }
    },
)
