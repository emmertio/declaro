import type { ZodAny } from 'zod'

export function privateField<TField extends ZodAny>(field: TField) {
    return field.meta({
        private: true,
    })
}

export function hiddenField<TField extends ZodAny>(field: TField) {
    return field.meta({
        hidden: true,
    })
}
