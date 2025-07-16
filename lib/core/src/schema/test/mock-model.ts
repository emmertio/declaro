import type { StandardSchemaV1 } from '@standard-schema/spec'
import { Model } from '../model'
import type { JSONSchema } from '../json-schema'

export class MockModel<TName extends Readonly<string>, TSchema extends StandardSchemaV1> extends Model<TName, TSchema> {
    constructor(name: TName, schema: TSchema) {
        super(name, schema)
    }

    toJSONSchema(): JSONSchema {
        return {
            $id: `https://example.com/schemas/${this.name}.json`,
            type: 'object',
            properties: {},
            required: [],
        }
    }
}
