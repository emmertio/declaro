import type { IAnyModel, JSONSchema, ModelSchemaOptions } from '@declaro/core'
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

    /**
     * Builds the partial companion for `partial()` by delegating to Zod.
     *
     * Zod's `.partial()` makes every field optional while keeping its constraints and metadata,
     * so a fragment is accepted when the fields it carries are valid, a private field stays
     * private, and an invalid value is still rejected.
     *
     * Schemas that are not objects, such as an array or a scalar, have no partial form and fall
     * back to whole-payload validation.
     *
     * @returns The partial companion model, or undefined when the schema is not an object.
     */
    protected override buildPartialModel(): IAnyModel | undefined {
        const schema = this.schema as { partial?: () => $ZodType<any> }

        if (typeof schema.partial !== 'function') {
            return undefined
        }

        return new ZodModel(this.name, schema.partial())
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
            },
            ...zodOptions,
        })
        if (options?.includePrivateFields !== true) {
            stripPrivateFieldsFromSchema(jsonSchema as JSONSchema)
        }
        return jsonSchema as JSONSchema
    }
}
