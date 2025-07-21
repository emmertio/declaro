import type { JSONSchema } from '@declaro/core'
import { Model } from '@declaro/core'
import { z } from 'zod/v4'
import type { $ZodType } from 'zod/v4/core'
import { de } from 'zod/v4/locales'

export class ZodModel<TName extends Readonly<string>, TSchema extends $ZodType<any>> extends Model<TName, TSchema> {
    constructor(name: TName, schema: TSchema) {
        super(name, schema)
    }

    toJSONSchema(options?: Parameters<typeof z.toJSONSchema>[1]): JSONSchema {
        const jsonSchema = z.toJSONSchema(
            this.schema,
            options ?? {
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
            },
        )
        return jsonSchema as JSONSchema
    }
}
