import type { Model, SnakeCase } from '@declaro/core'
import { splitSeparateNumbers } from 'change-case'
import _ from 'lodash-es'
import type { AnyColumnBuilderBase, DrizzleMap, InferDefaultColumnConfig } from './map-builder'

export type InferTableSchema<TModel extends Model<any, string>, TColumnMap> = {
    [K in keyof TModel['schema']['properties']]: InferDefaultColumnConfig<
        TColumnMap,
        TModel['schema']['properties'][K]['type']
    >
}

export function drizzleTableInput<
    TModel extends Model<any, Readonly<string>>,
    TMap extends DrizzleMap<AnyColumnBuilderBase>,
>(model: TModel, columnMap: TMap): InferTableSchema<TModel, TMap> {
    const table = {}
    for (const [key, value] of Object.entries(model.schema.properties)) {
        const column = columnMap[value.type]({
            property: value,
            model: model,
        })

        if (!column) {
            throw new Error(`Could not find column for type ${value.type}`)
        }
        table[key] = _.cloneDeep(column) // We need to clone the column so we can be sure that any mutations don't leak into the framework
    }
    return table as InferTableSchema<TModel, TMap>
}

export function tableName<TModel extends Model<any, Readonly<string>>>(model: TModel) {
    return splitSeparateNumbers(model.name)
        .map((word) => word.toLowerCase())
        .join('_') as SnakeCase<(typeof model)['name']>
}
