import type { JSONSchema } from './json-schema'
import type { IAnyModel } from './model'

/**
 * Guards against payloads that reference themselves.
 */
const MAX_WRAP_DEPTH = 100

/**
 * Identifies a wrapper's prototype. Stored on the prototype rather than the value so that it never
 * appears in `Object.keys`, `JSON.stringify`, or equality comparisons.
 */
const WRAP_META = Symbol('declaro.wrapMeta')

/**
 * Options controlling how a wrapped value serializes.
 */
export interface WrapModelOptions {
    /**
     * Whether the payload is validated when it is serialized. Defaults to true.
     *
     * Validation also coerces values, so a validated payload serializes in its canonical form.
     * Set false to skip both on hot paths, or for models that validate asynchronously.
     */
    validate?: boolean

    /**
     * Whether fields marked `private: true` are included in the serialized output.
     * Defaults to false. Set true for trusted consumers such as an internal cache or queue.
     */
    includePrivateFields?: boolean
}

/**
 * A wrapped value's serialization settings.
 */
interface IWrapMeta {
    model: IAnyModel
    options: Required<WrapModelOptions>
}

/**
 * The methods added to a wrapped value.
 */
export interface IWrappedModel {
    /**
     * Serializes the value according to its model. Called automatically by `JSON.stringify`.
     */
    toJSON(): unknown

    /**
     * Returns the model describing this value.
     */
    getModel(): IAnyModel

    /**
     * Returns the name of the model describing this value.
     */
    getModelName(): string

    /**
     * Returns the JSON Schema for this value, honouring its private field setting.
     */
    introspect(): JSONSchema
}

/**
 * Wrapper prototypes, reused across every value wrapped with the same model and settings.
 */
const prototypeCache = new WeakMap<IAnyModel, Map<string, IWrappedModel>>()

/**
 * Builds the cache key for a set of wrap options.
 * @param options The resolved options.
 * @returns A key identifying the options.
 */
function getOptionsKey(options: Required<WrapModelOptions>): string {
    return `${options.validate}:${options.includePrivateFields}`
}

/**
 * Builds the prototype shared by every value wrapped with the same model and settings.
 * @param model The model describing the wrapped values.
 * @param options The resolved options.
 * @returns The wrapper prototype.
 */
function createWrapperPrototype(
    model: IAnyModel,
    options: Required<WrapModelOptions>,
): IWrappedModel & { [WRAP_META]: IWrapMeta } {
    const meta: IWrapMeta = { model, options }

    return {
        [WRAP_META]: meta,

        toJSON(this: object): unknown {
            // Unwrapping first gives a plain object, so the serialized result can never carry the
            // wrapper's own toJSON back into JSON.stringify.
            const raw = unwrapModel(this)

            if (!options.validate) {
                return options.includePrivateFields ? raw : model.stripExcludedFields(raw)
            }

            const result = model.validateSync(raw, { includePrivateFields: true })
            const validated = 'value' in result ? result.value : raw

            return options.includePrivateFields ? validated : model.stripExcludedFields(validated)
        },

        getModel(): IAnyModel {
            return model
        },

        getModelName(): string {
            return model.name
        },

        introspect(): JSONSchema {
            return model.toJSONSchema({ includePrivateFields: options.includePrivateFields })
        },
    }
}

/**
 * Returns the prototype for a model and set of options, building it on first use.
 * @param model The model describing the wrapped values.
 * @param options The resolved options.
 * @returns The wrapper prototype.
 */
function getWrapperPrototype(model: IAnyModel, options: Required<WrapModelOptions>): IWrappedModel {
    let byOptions = prototypeCache.get(model)
    if (!byOptions) {
        byOptions = new Map()
        prototypeCache.set(model, byOptions)
    }

    const key = getOptionsKey(options)
    let prototype = byOptions.get(key)

    if (!prototype) {
        prototype = createWrapperPrototype(model, options)
        byOptions.set(key, prototype)
    }

    return prototype
}

/**
 * Reads the wrap settings from a value.
 * @param value The value to inspect.
 * @returns The settings, or undefined if the value is not wrapped.
 */
function getWrapMeta(value: unknown): IWrapMeta | undefined {
    if (value === null || typeof value !== 'object') {
        return undefined
    }

    return (value as Record<symbol, IWrapMeta | undefined>)[WRAP_META]
}

/**
 * Determines whether a value has been wrapped.
 * @param value The value to inspect.
 * @returns True if the value serializes according to a model.
 */
export function isWrapped(value: unknown): boolean {
    return getWrapMeta(value) !== undefined
}

/**
 * Returns the model a value was wrapped with.
 * @param value The value to inspect.
 * @returns The model, or undefined if the value is not wrapped.
 */
export function getWrappedModel(value: unknown): IAnyModel | undefined {
    return getWrapMeta(value)?.model
}

/**
 * Returns the settings a value was wrapped with.
 * @param value The value to inspect.
 * @returns The settings, or undefined if the value is not wrapped.
 */
export function getWrapOptions(value: unknown): Required<WrapModelOptions> | undefined {
    return getWrapMeta(value)?.options
}

/**
 * Wraps a value so that serializing it applies its model's rules.
 *
 * Wrapping only configures serialization, it does not perform it, so it is cheap enough to apply
 * at every layer that returns a payload. Re-wrapping replaces the previous settings rather than
 * nesting.
 *
 * Reading properties directly is unaffected: the service layer still sees every field.
 *
 * @param model The model describing the value.
 * @param value The value to wrap.
 * @param options Settings controlling how the value serializes.
 * @returns The wrapped value, or the original if it cannot be wrapped.
 */
export function wrapModel<T>(model: IAnyModel, value: T, options?: WrapModelOptions): T {
    if (value === null || typeof value !== 'object' || value instanceof Date) {
        return value
    }

    const resolved: Required<WrapModelOptions> = {
        validate: options?.validate ?? true,
        includePrivateFields: options?.includePrivateFields ?? false,
    }

    const prototype = getWrapperPrototype(model, resolved)

    // Copying own properties, rather than reading them through the prototype chain, keeps
    // Object.keys, spread and equality comparisons behaving exactly as they do for a plain object.
    return Object.assign(Object.create(prototype), unwrapModel(value)) as T
}

/**
 * Returns the plain object behind a wrapped value.
 * @param value The value to unwrap.
 * @returns The unwrapped value, or the original if it was never wrapped.
 */
export function unwrapModel<T>(value: T): T {
    if (!isWrapped(value)) {
        return value
    }

    return { ...(value as object) } as T
}

/**
 * Determines whether a value should be walked when transforming a payload.
 * @param value The value to inspect.
 * @returns True for plain objects and wrapped values.
 */
function isTraversable(value: unknown): boolean {
    if (value === null || typeof value !== 'object' || value instanceof Date) {
        return false
    }

    const prototype = Object.getPrototypeOf(value)

    return prototype === Object.prototype || prototype === null || isWrapped(value)
}

/**
 * Walks a payload, unwrapping every wrapped value and handing each plain result to a mapper.
 * @param value The payload to walk.
 * @param mapNode Produces the replacement for each unwrapped object.
 * @param depth The current recursion depth.
 * @returns The transformed payload, or the original if nothing changed.
 */
function mapDeep<T>(
    value: T,
    mapNode: (plain: Record<string, unknown>, model: IAnyModel | undefined) => unknown,
    depth: number,
): T {
    if (depth >= MAX_WRAP_DEPTH) {
        return value
    }

    if (Array.isArray(value)) {
        let hasChanges = false
        const items = value.map((item) => {
            const mapped = mapDeep(item, mapNode, depth + 1)
            hasChanges ||= mapped !== item
            return mapped
        })

        return (hasChanges ? items : value) as T
    }

    if (!isTraversable(value)) {
        return value
    }

    const model = getWrappedModel(value)
    const source = unwrapModel(value) as Record<string, unknown>

    let hasChanges = source !== (value as unknown)
    const result: Record<string, unknown> = {}

    for (const [key, child] of Object.entries(source)) {
        const mapped = mapDeep(child, mapNode, depth + 1)
        hasChanges ||= mapped !== child
        result[key] = mapped
    }

    return mapNode(hasChanges ? result : (value as Record<string, unknown>), model) as T
}

/**
 * Unwraps every wrapped value in a payload, including those nested in objects and arrays.
 *
 * Use this before persisting or transporting a payload that must keep its private fields, since
 * anything that calls `JSON.stringify` on a wrapped value receives the stripped form.
 *
 * @param value The payload to unwrap.
 * @returns The payload with no wrapped values.
 */
export function unwrapDeep<T>(value: T): T {
    return mapDeep(value, (plain) => plain, 0)
}

/**
 * Re-wraps every wrapped value in a payload with new settings, keeping each value's own model.
 *
 * Use this to opt a trusted consumer into a different serialization, such as a queue that should
 * receive private fields.
 *
 * @param value The payload to re-wrap.
 * @param options The settings to apply.
 * @returns The payload with its wrapped values re-configured.
 */
export function rewrapDeep<T>(value: T, options: WrapModelOptions): T {
    return mapDeep(value, (plain, model) => (model ? wrapModel(model, plain, options) : plain), 0)
}
