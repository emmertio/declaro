import type { JSONSchema, ModelSchemaOptions } from '@declaro/core'
import { Model, stripPrivateFieldsFromSchema } from '@declaro/core'
import z4 from 'zod/v4'
import type { $ZodType } from 'zod/v4/core'

export type ZodToJSONArgs = Parameters<typeof z4.toJSONSchema>[1]
export interface ZodModelSchemaOptions extends ModelSchemaOptions {
    zodOptions?: ZodToJSONArgs
}

export class ZodModel<TName extends Readonly<string>, TSchema extends $ZodType<any>> extends Model<TName, TSchema> {
    constructor(name: TName, schema: TSchema) {
        super(name, schema)
    }

    toJSONSchema(options?: ZodModelSchemaOptions): JSONSchema {
        const zodOptions = options?.zodOptions
        const jsonSchema = z4.toJSONSchema(this.schema, {
            unrepresentable: 'any',
            override: (ctx) => {
                const def = ctx.zodSchema._zod.def
                if (def.type === 'date') {
                    ctx.jsonSchema.type = 'string'
                    ctx.jsonSchema.format = 'date-time'
                }
                if (def.type === 'bigint') {
                    ctx.jsonSchema.type = 'string'
                    ctx.jsonSchema.format = 'bigint'
                }
            },
            ...zodOptions,
        })
        if (options?.includePrivateFields !== true) {
            stripPrivateFieldsFromSchema(jsonSchema)
        }
        return jsonSchema as JSONSchema
    }
}
