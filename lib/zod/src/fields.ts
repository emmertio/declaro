import type { ZodType } from 'zod/v4'

/**
 * Marks a field as private, so it is removed whenever a payload crosses a boundary.
 *
 * On a read model the field is never sent to a client. On an input model a client cannot write to
 * it, which is how a service keeps ownership of a computed value.
 *
 * The field is made optional because it is stripped before validation runs, so a required private
 * field could never satisfy its own model.
 *
 * @param field The field to mark private.
 * @returns The field, marked private and optional.
 */
export function privateField<TField extends ZodType>(field: TField) {
    return field.optional().meta({
        private: true,
    })
}

/**
 * Marks a field as hidden, so it is omitted from generated user interfaces.
 *
 * Hidden fields are still sent and still validated. Use `privateField` to keep a value from
 * leaving the service.
 *
 * @param field The field to mark hidden.
 * @returns The field, marked hidden.
 */
export function hiddenField<TField extends ZodType>(field: TField) {
    return field.meta({
        hidden: true,
    })
}
