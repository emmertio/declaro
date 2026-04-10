import type { AnyModelSchema, Model, ModelSchema } from '@declaro/core'
import type { InferEntityMetadata } from './schema-inference'

/**
 * Represents a child schema that inherits from a parent schema.
 * This is useful for creating schemas that extend the functionality of an existing schema.
 * It replaces the schema name and all model names with a string type.
 *
 * @warning This type is intended for use in generic types. In most cases, you should use concrete schemas for inheritance for best type inference.
 *
 * @template TSchema - The parent schema type.
 * @example
 * ```ts
 * import { ModelSchema, ChildSchema } from '@declaro/core';
 *
 * export class ParentService<TSchema extends ChildSchema<typeof ParentSchema>> extends ModelService<TSchema> {
 *     constructor(args: IModelServiceArgs<TSchema>) {
 *         super(args);
 *     }
 * }
 */
export type ChildSchema<TSchema extends AnyModelSchema> = ModelSchema<
    string,
    {
        [K in keyof TSchema['definition']]: Model<string, TSchema['definition'][K]['schema']>
    },
    InferEntityMetadata<TSchema>
>
