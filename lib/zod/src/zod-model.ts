import type { JSONSchema } from '@declaro/core'
import { Model } from '@declaro/core'
import { z, ZodObject } from 'zod/v4'

export class ZodModel<TName extends Readonly<string>, TSchema extends ZodObject> extends Model<TName, TSchema> {
    constructor(name: TName, schema: TSchema) {
        super(name, schema)
    }

    async toJSONSchema(): Promise<JSONSchema> {
        const jsonSchema = z.toJSONSchema(this.schema)
        return jsonSchema as JSONSchema
    }
}
