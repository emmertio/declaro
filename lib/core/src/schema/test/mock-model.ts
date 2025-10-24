import { z } from 'zod/v4'
import type { $ZodType } from 'zod/v4/core'
import type { JSONSchema } from '../json-schema'
import { Model, type ModelSchemaOptions } from '../model'
import { stripPrivateFieldsFromSchema } from 'src/shared/utils/schema-utils'

export class MockModel<TName extends Readonly<string>, TSchema extends $ZodType<any>> extends Model<TName, TSchema> {
    constructor(name: TName, schema: TSchema) {
        super(name, schema)
    }

    toJSONSchema(options?: ModelSchemaOptions): JSONSchema {
        const jsonSchema = z.toJSONSchema(this.schema)
        if (options?.includePrivateFields !== true) {
            stripPrivateFieldsFromSchema(jsonSchema as JSONSchema)
        }
        return jsonSchema as JSONSchema
    }
}
