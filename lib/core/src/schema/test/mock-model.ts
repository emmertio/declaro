import { z } from 'zod/v4'
import type { $ZodType } from 'zod/v4/core'
import type { JSONSchema } from '../json-schema'
import { Model, type ModelSchemaOptions } from '../model'
import { stripPrivateFieldsFromSchema } from '../../shared/utils/schema-utils'

export class MockModel<TName extends Readonly<string>, TSchema extends $ZodType<any>> extends Model<TName, TSchema> {
    constructor(name: TName, schema: TSchema) {
        super(name, schema)
    }

    toJSONSchema(options?: ModelSchemaOptions): JSONSchema {
        // Matching ZodModel, so a schema carrying a transform describes the fields around it
        // rather than refusing to be described at all.
        const jsonSchema = z.toJSONSchema(this.schema, { unrepresentable: 'any' })
        if (options?.includePrivateFields !== true) {
            stripPrivateFieldsFromSchema(jsonSchema as JSONSchema)
        }
        return jsonSchema as JSONSchema
    }
}
