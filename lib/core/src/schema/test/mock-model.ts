import { z } from 'zod/v4'
import type { $ZodType } from 'zod/v4/core'
import type { JSONSchema } from '../json-schema'
import { Model } from '../model'

export class MockModel<TName extends Readonly<string>, TSchema extends $ZodType<any>> extends Model<TName, TSchema> {
    constructor(name: TName, schema: TSchema) {
        super(name, schema)
    }

    toJSONSchema(): JSONSchema {
        const jsonSchema = z.toJSONSchema(this.schema)
        return jsonSchema as JSONSchema
    }
}
