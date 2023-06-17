import { Validation } from './validation'

export type Validator<T> = (value: T) => boolean | Promise<boolean>

export function validate<T>(
    subject: T,
    ...validators: Validator<T>[]
): Validation<T> {
    const valid = allValid(subject, ...validators)
    const validation = new Validation(valid, subject)

    return validation
}

export function validateAny(subject, ...validators) {
    const valid = anyValid(subject, ...validators)
    const validation = new Validation(valid, subject)

    return validation
}

export async function allValid<T>(
    subject: T,
    ...validators: Validator<T>[]
): Promise<boolean> {
    for (const validator of validators) {
        const isValid = await validator(subject)
        if (!isValid) {
            return false
        }
    }

    return true
}

export async function anyValid<T>(
    subject: T,
    ...validators: Validator<T>[]
): Promise<boolean> {
    for (const validator of validators) {
        const isValid = await validator(subject)
        if (isValid) {
            return true
        }
    }

    return false
}
