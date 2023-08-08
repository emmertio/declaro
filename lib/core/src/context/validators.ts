import { Context } from '../context/context'
import { type Validator, validate, validateAny } from '../validation'

export class ContextValidator {
    static all(...validators: Validator<Context>[]) {
        return async (context: Context) =>
            validate(context, ...validators).valid
    }

    static any(...validators: Validator<Context>[]) {
        return async (context: Context) =>
            validateAny(context, ...validators).valid
    }
}
