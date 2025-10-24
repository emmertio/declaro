import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { JSONSchema } from './json-schema'
import { SystemError, ValidationError } from '../errors/errors'
import { getLabels, type ModelLabels } from './labels'

export interface ModelValidationOptions {
    strict?: boolean
}

export interface ModelSchemaOptions {
    includePrivateFields?: boolean
}

export function getDefaultModelSchemaOptions(): ModelSchemaOptions {
    return {
        includePrivateFields: false,
    }
}

export abstract class Model<TName extends Readonly<string>, TSchema extends StandardSchemaV1>
    implements StandardSchemaV1<StandardSchemaV1.InferInput<TSchema>, StandardSchemaV1.InferOutput<TSchema>>
{
    public readonly name: TName
    /**
     * @warning You may not need to use this property directly.
     * Use the `validate` method instead to ensure proper validation and error handling.
     * Use the `toJSONSchema` method to get the JSON Schema representation for introspection or documentation.
     */
    public readonly schema: TSchema

    constructor(name: TName, schema: TSchema) {
        if (!schema || !schema['~standard'] || schema['~standard'].version !== 1) {
            throw new SystemError(`Invalid schema provided for model "${name}". Must implement StandardSchemaV1.`)
        }

        this.name = name
        this.schema = schema
    }

    stripExcludedFields(value: StandardSchemaV1.InferInput<TSchema>): StandardSchemaV1.InferInput<TSchema> {
        const meta = this.toJSONSchema({
            includePrivateFields: true,
        })

        const excludedKeys = Object.keys(meta.properties ?? {}).filter((key) => {
            const property = meta.properties?.[key]
            return !!property && typeof property === 'object' && property.private === true
        })

        if (value && excludedKeys.length > 0) {
            excludedKeys.forEach((key) => {
                delete value[key]
            })
        }

        return value
    }

    async validate(
        value: StandardSchemaV1.InferInput<TSchema>,
        options?: ModelValidationOptions,
    ): Promise<StandardSchemaV1.Result<StandardSchemaV1.InferOutput<TSchema>>> {
        const meta = this.toJSONSchema()

        value = this.stripExcludedFields(value)

        const result = await this.schema['~standard'].validate(value)

        if (result.issues) {
            const issues = result.issues.map((issue) => {
                let schema: JSONSchema | undefined = meta
                let field: string | undefined = undefined
                issue.path?.forEach((segment) => {
                    field = segment as string
                    const nested = schema?.properties?.[segment as string] as JSONSchema | undefined
                    if (nested) {
                        schema = nested
                    } else {
                        schema = undefined
                    }
                })

                let title = schema?.title
                if (!title && field) {
                    const labels = getLabels(field)

                    title = labels?.singularLabel
                }

                const message = title ? `Validation failed for field "${title}": ${issue.message}` : issue.message

                return {
                    ...issue,
                    message,
                }
            })

            const message = issues.map((issue) => issue.message)?.[0]

            if (options?.strict === false) {
                return {
                    issues,
                }
            }

            throw new ValidationError(message, { result })
        }

        return result
    }

    get labels(): ModelLabels {
        return getLabels(this.name)
    }

    abstract toJSONSchema(options?: ModelSchemaOptions): JSONSchema

    // Implementing StandardSchemaV1 interface
    get version(): number {
        return 1
    }

    // Correcting the '~standard' property implementation to match StandardSchemaV1
    get '~standard'(): StandardSchemaV1['~standard'] {
        return {
            version: 1,
            vendor: 'Declaro',
            validate: this.validate.bind(this),
        }
    }
}

export type UnwrapModelSchema<T extends Model<any, any>> = T extends Model<any, infer S> ? S : never
export type InferModelOutput<T extends Model<any, any>> = StandardSchemaV1.InferOutput<UnwrapModelSchema<T>>
export type InferModelInput<T extends Model<any, any>> = StandardSchemaV1.InferInput<UnwrapModelSchema<T>>

export type IAnyModel = Model<Readonly<string>, StandardSchemaV1>

export interface IModelHelper<TNameRecommendation extends Readonly<string>> {
    name: TNameRecommendation
}

export type ModelFactory<TName extends Readonly<string>> = (helper: IModelHelper<TName>) => IAnyModel
