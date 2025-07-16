import type { JSONSchema } from '@declaro/core'
import { Model } from '@declaro/core'
import { z } from 'zod/v4'
import type { $ZodType } from 'zod/v4/core'

export class ZodModel<TName extends Readonly<string>, TSchema extends $ZodType<any>> extends Model<TName, TSchema> {
    constructor(name: TName, schema: TSchema) {
        super(name, schema)
    }

    toJSONSchema(): JSONSchema {
        const jsonSchema = z.toJSONSchema(this.schema)
        return jsonSchema as JSONSchema
    }
}
