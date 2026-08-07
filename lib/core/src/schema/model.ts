import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { JSONSchema } from './json-schema'
import { SystemError, ValidationError } from '../errors/errors'
import { getLabels, type ModelLabels } from './labels'
import { stripPrivateValues } from '../shared/utils/schema-utils'

export interface ModelValidationOptions {
    /**
     * When false, validation issues are returned instead of thrown. Defaults to true.
     */
    strict?: boolean

    /**
     * When true, fields marked `private: true` are kept instead of being stripped from the input.
     *
     * Private fields are removed by default so that a client cannot write to a field the service
     * owns, such as a computed value. Set this from the service layer when it legitimately needs
     * to set those fields.
     */
    includePrivateFields?: boolean
}

export interface ModelSchemaOptions {
    /**
     * When true, fields marked `private: true` are present in the generated JSON Schema.
     * Defaults to false, so a published schema does not reveal that the fields exist.
     */
    includePrivateFields?: boolean
}

/**
 * Builds the default options used when generating a model's JSON Schema.
 * @returns The default JSON Schema options.
 */
export function getDefaultModelSchemaOptions(): ModelSchemaOptions {
    return {
        includePrivateFields: false,
    }
}

export abstract class Model<
    TName extends Readonly<string>,
    TSchema extends StandardSchemaV1,
> implements StandardSchemaV1<StandardSchemaV1.InferInput<TSchema>, StandardSchemaV1.InferOutput<TSchema>> {
    public readonly name: TName
    /**
     * @warning You may not need to use this property directly.
     * Use the `validate` method instead to ensure proper validation and error handling.
     * Use the `toJSONSchema` method to get the JSON Schema representation for introspection or documentation.
     */
    public readonly schema: TSchema

    /**
     * Memoized JSON Schemas, keyed by whether private fields are included.
     *
     * Building a JSON Schema is by far the most expensive part of stripping a payload, and it is
     * repeated for every record on a response. These copies are never handed to callers, because
     * consumers of `toJSONSchema` are free to modify what they receive.
     */
    private readonly jsonSchemaCache = new Map<boolean, JSONSchema>()

    constructor(name: TName, schema: TSchema) {
        if (!schema || !schema['~standard'] || schema['~standard'].version !== 1) {
            throw new SystemError(`Invalid schema provided for model "${name}". Must implement StandardSchemaV1.`)
        }

        this.name = name
        this.schema = schema
    }

    /**
     * Returns a memoized JSON Schema for internal use.
     *
     * The result is shared between calls and must not be modified. Use `toJSONSchema` to obtain a
     * schema that is safe to mutate.
     *
     * @param includePrivateFields Whether fields marked `private: true` should be present.
     * @returns The JSON Schema representation of this model.
     */
    protected getInternalJSONSchema(includePrivateFields: boolean): JSONSchema {
        const cached = this.jsonSchemaCache.get(includePrivateFields)
        if (cached) {
            return cached
        }

        const schema = this.toJSONSchema({ includePrivateFields })
        this.jsonSchemaCache.set(includePrivateFields, schema)

        return schema
    }

    /**
     * Removes every field marked `private: true` from a payload, including fields nested in
     * objects and arrays.
     *
     * The input is not modified. When nothing needs to be removed the original value is returned
     * by reference.
     *
     * @param value The payload to strip.
     * @returns The payload without its private fields.
     */
    stripExcludedFields(value: StandardSchemaV1.InferInput<TSchema>): StandardSchemaV1.InferInput<TSchema> {
        return stripPrivateValues(value, this.getInternalJSONSchema(true))
    }

    /**
     * Turns raw validation issues into issues whose messages name the field that failed.
     * @param issues The issues reported by the underlying schema.
     * @returns The issues, with human readable messages.
     */
    private formatIssues(issues: readonly StandardSchemaV1.Issue[]): StandardSchemaV1.Issue[] {
        const meta = this.getInternalJSONSchema(false)

        return issues.map((issue) => {
            let schema: JSONSchema | undefined = meta
            let field: string | undefined = undefined

            issue.path?.forEach((segment) => {
                field = segment as string
                const nested = schema?.properties?.[segment as string] as JSONSchema | undefined
                schema = nested ?? undefined
            })

            let title = schema?.title
            if (!title && field) {
                title = getLabels(field)?.singularLabel
            }

            const message = title ? `Validation failed for field "${title}": ${issue.message}` : issue.message

            return {
                ...issue,
                message,
            }
        })
    }

    /**
     * Prepares a payload for validation by stripping the fields a client is not allowed to write.
     * @param value The payload to prepare.
     * @param options Options controlling whether private fields are kept.
     * @returns The payload to validate.
     */
    private prepareValidationInput(
        value: StandardSchemaV1.InferInput<TSchema>,
        options?: ModelValidationOptions,
    ): StandardSchemaV1.InferInput<TSchema> {
        return options?.includePrivateFields === true ? value : this.stripExcludedFields(value)
    }

    /**
     * Applies this model's error handling to a validation result.
     * @param result The result reported by the underlying schema.
     * @param options Options controlling whether issues are thrown.
     * @returns The result, with formatted issues.
     * @throws ValidationError When the payload is invalid and `strict` is not false.
     */
    private handleValidationResult(
        result: StandardSchemaV1.Result<StandardSchemaV1.InferOutput<TSchema>>,
        options?: ModelValidationOptions,
    ): StandardSchemaV1.Result<StandardSchemaV1.InferOutput<TSchema>> {
        if (!result.issues) {
            return result
        }

        const issues = this.formatIssues(result.issues)

        if (options?.strict === false) {
            return { issues }
        }

        throw new ValidationError(issues[0]?.message, { result })
    }

    /**
     * Validates a payload against this model, stripping any fields marked `private: true` first.
     * @param value The payload to validate.
     * @param options Options controlling error handling and private field stripping.
     * @returns The validation result.
     * @throws ValidationError When the payload is invalid and `strict` is not false.
     */
    async validate(
        value: StandardSchemaV1.InferInput<TSchema>,
        options?: ModelValidationOptions,
    ): Promise<StandardSchemaV1.Result<StandardSchemaV1.InferOutput<TSchema>>> {
        const result = await this.schema['~standard'].validate(this.prepareValidationInput(value, options))

        return this.handleValidationResult(result, options)
    }

    /**
     * Validates a payload synchronously.
     *
     * Serialization cannot await, so this is the path used when a wrapped model validates on
     * `toJSON`. Models whose underlying schema validates asynchronously cannot be validated here.
     *
     * @param value The payload to validate.
     * @param options Options controlling error handling and private field stripping.
     * @returns The validation result.
     * @throws SystemError When the underlying schema requires asynchronous validation.
     * @throws ValidationError When the payload is invalid and `strict` is not false.
     */
    validateSync(
        value: StandardSchemaV1.InferInput<TSchema>,
        options?: ModelValidationOptions,
    ): StandardSchemaV1.Result<StandardSchemaV1.InferOutput<TSchema>> {
        const result = this.schema['~standard'].validate(this.prepareValidationInput(value, options))

        if (result instanceof Promise) {
            throw new SystemError(
                `Model "${this.name}" requires asynchronous validation and cannot be validated synchronously. ` +
                    `Serialize it with { validate: false } to skip validation.`,
            )
        }

        return this.handleValidationResult(result, options)
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
            // The specification requires issues to be returned rather than thrown, so that
            // consumers such as router level validators can turn them into a response.
            validate: (value) => this.validate(value as StandardSchemaV1.InferInput<TSchema>, { strict: false }),
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
