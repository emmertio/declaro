import { type Model, type SnakeCase } from '@declaro/core'
import type { DeclaroSchema } from '@declaro/core/dist/schema/types'
import { splitSeparateNumbers } from 'change-case'
import type { ColumnBuilderBase, ColumnBuilderBaseConfig, ColumnDataType, Table } from 'drizzle-orm'
import { Column } from 'drizzle-orm'
import { pgTable } from 'drizzle-orm/pg-core'
import { drizzleTableInput } from './model'

export function defineDrizzleColumn<TColumn extends Column>(column: TColumn): TColumn {
    return column
}

export type DrizzleMap<TColumnConfig extends AnyColumnBuilderBase> = Partial<
    Record<DeclaroSchema.AnySchemaObjectType, ColumnFn<TColumnConfig>>
>

export type InferDefaultColumnConfig<
    TMap extends DrizzleMap<AnyColumnBuilderBase>,
    TType extends DeclaroSchema.AnySchemaObjectType,
> = ReturnType<TMap[TType]>

export type ColumnFnArgs = {
    property: DeclaroSchema.SchemaObject<DeclaroSchema.AnyObjectProperties>
    model: DeclaroSchema.SchemaObject<DeclaroSchema.AnyObjectProperties>
}

export interface AnyColumnBuilderBase<
    T extends ColumnBuilderBaseConfig<ColumnDataType, string> = ColumnBuilderBaseConfig<ColumnDataType, string>,
    TTypeConfig extends object = object,
> extends ColumnBuilderBase<T, TTypeConfig> {}

export type ColumnFn<TColumn extends AnyColumnBuilderBase> = (args: ColumnFnArgs) => TColumn

export type AdapterTableFn<TMap extends DrizzleMap<AnyColumnBuilderBase>, TTable extends Table> = <
    TModel extends Model<any, Readonly<string>>,
>(
    model: TModel,
    columnMap: TMap,
) => TTable

export type AdapterConfig<TMap extends DrizzleMap<AnyColumnBuilderBase>, TTable extends Table> = {
    table: <TModel extends Model<any, Readonly<string>>>(model: TModel, map: TMap) => TTable
}

export function drizzleTable<
    TModel extends Model<any, Readonly<string>>,
    TMap extends DrizzleMap<AnyColumnBuilderBase>,
>(model: TModel, columnMap: TMap) {
    const table = pgTable(
        splitSeparateNumbers(model.name)
            .map((word) => word.toLowerCase())
            .join('_') as SnakeCase<TModel['name']>,
        drizzleTableInput<TModel, TMap>(model, columnMap),
    )
    return table
}

export type TableFn<TMap extends DrizzleMap<AnyColumnBuilderBase>, T> = <TModel extends Model<any, Readonly<string>>>(
    model: TModel,
    map: TMap,
) => T

export type Adapter<TMap extends DrizzleMap<AnyColumnBuilderBase>, TActions extends AdapterActions> = {
    map: TMap
} & TActions

export type AdapterActions = {
    table: <TModel extends Model<any, Readonly<string>>>(model: TModel) => Table
}

export type AdapterConfigFn<TMap extends DrizzleMap<AnyColumnBuilderBase>> = (map: TMap) => AdapterActions

export function defineAdapter<TMap extends DrizzleMap<AnyColumnBuilderBase>, TAdapterFn extends AdapterConfigFn<TMap>>(
    map: TMap,
    adapterFactory: TAdapterFn,
): Adapter<TMap, ReturnType<TAdapterFn>> {
    const actions = adapterFactory(map)

    return {
        ...actions,
        map,
    } as Adapter<TMap, ReturnType<TAdapterFn>>
}
