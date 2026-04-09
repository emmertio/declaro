import { AuthValidator, type IInstanceWithAuthValidator, type PermissionValidationFn } from '../utils/auth-validator'
import { UnauthorizedError } from '@declaro/core'

/**
 * Decorator to validate permissions before executing a method.
 *
 * Usage:
 * ```typescript
 * class MyController {
 *     protected readonly authValidator = new AuthValidator(authSession, authService);
 *
 *     @ValidatePermissions(v => v.someOf(['permission-1', 'permission-2']).allOf(['required-permission-1', 'required-permission-2']))
 *     foo() {
 *         return 'bar';
 *     }
 * }
 * ```
 *
 * The decorated method will only execute if the `authValidator` instance has a valid `authSession`.
 *
 * @param validate - A function to define permission validation logic using `PermissionValidator`.
 */
export function ValidatePermissions(validate: PermissionValidationFn) {
    return function (targetOrFn: any, propertyKeyOrContext: any, descriptor?: PropertyDescriptor) {
        // Stage 3 decorator: second argument is a context object with a `kind` property
        if (typeof propertyKeyOrContext === 'object' && propertyKeyOrContext !== null && 'kind' in propertyKeyOrContext) {
            if (propertyKeyOrContext.kind !== 'method') {
                throw new Error('ValidatePermissions can only be applied to methods.')
            }
            return function (this: IInstanceWithAuthValidator, ...args: any[]) {
                const validator = AuthValidator.createFromClass(this)
                if (!validator.validatePermissions(validate, true)) {
                    throw new UnauthorizedError('Permission validation failed.')
                }
                return targetOrFn.apply(this, args)
            }
        }

        // Legacy decorator: (target, propertyKey, descriptor)
        if (!descriptor) {
            throw new Error('ValidatePermissions can only be applied to methods.')
        }

        const original = descriptor.value

        descriptor.value = function (this: IInstanceWithAuthValidator, ...args: any[]) {
            const validator = AuthValidator.createFromClass(this)
            if (!validator.validatePermissions(validate, true)) {
                throw new UnauthorizedError('Permission validation failed.')
            }
            return original.apply(this, args)
        }

        return descriptor
    }
}
