import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'
import { getEntityLabels } from '@declaro/core'
import { getTableColumns, getTableName, Table } from 'drizzle-orm'
import {
    createInsertSchema,
    createSelectSchema,
    type BuildInsertSchema,
    type BuildSelectSchema,
    type Refine,
} from 'drizzle-zod'
import { z } from 'zod'
import { capitalCase } from 'change-case'

extendZodWithOpenApi(z)

export type BaseOpenApiMeta = {
    title: string
}

export type TableSchema<TTable extends Table> = {
    insert: z.ZodObject<BuildInsertSchema<TTable, {}>>
    select: z.ZodObject<BuildSelectSchema<TTable, {}>>
}

export type ZodExtender<TType extends z.ZodTypeAny, TOut extends TType = TType> = (schema: TType) => TOut

export type InferTableZod<TTable extends Table> = z.ZodObject<BuildSelectSchema<TTable, {}>> // NOTE: This does not support changing zod types. That could be supported with more complex conditional types

export type BaseRefine<TTable extends Table> = {
    [K in keyof TTable['_']['columns']]?: ZodExtender<BuildSelectSchema<TTable, {}>[K]>
}

export function generateColumnSchema<TColumn>(column: TColumn) {}

export function generateSchema<TTable extends Table, TRefine extends BaseRefine<TTable>>(
    table: TTable,
    refine?: TRefine,
): TableSchema<TTable> {
    const tableName = getTableName(table)
    const tableLabels = getEntityLabels(tableName)

    const columns = getTableColumns(table)
    const columnMeta = Object.keys(columns).reduce(
        (acc, key: keyof typeof columns) => {
            const column = columns[key]

            const columnLables = getEntityLabels(column.name)

            return {
                [key]: {
                    title: columnLables.singularLabel,
                },
                ...acc,
            }
        },
        {} as {
            [K in keyof TTable]?: BaseOpenApiMeta
        },
    )

    const insertRefine = Object.keys(columnMeta).reduce((acc, key) => {
        const meta = columnMeta[key as keyof typeof columnMeta]
        const modify = refine?.[key]

        if (typeof modify !== 'function') {
            return {
                ...acc,
                [key]: (schema) => schema[key].openapi(meta),
            }
        }

        return {
            ...acc,
            [key]: (schema) => modify(schema[key] as any).openapi(meta),
        }
    }, {} as Refine<TTable, 'insert'>)

    const selectRefine = Object.keys(columnMeta).reduce((acc, key) => {
        const meta = columnMeta[key as keyof typeof columnMeta]
        const modify = refine?.[key]

        if (typeof modify !== 'function') {
            return {
                ...acc,
                [key]: (schema) => schema[key].openapi(meta),
            }
        }

        return {
            ...acc,
            [key]: (schema) => modify(schema[key] as any).openapi(meta),
        }
    }, {} as Refine<TTable, 'select'>)

    const insert = createInsertSchema(table, insertRefine as any).openapi({
        title: capitalCase(`${tableLabels.singularEntityName} Input`),
    })
    const select = createSelectSchema(table, selectRefine as any).openapi({
        title: capitalCase(tableLabels.singularEntityName),
    })

    return { insert, select }
}
