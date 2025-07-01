import { PermissionValidator, UnauthorizedError } from '@declaro/core'
import type { IAuthSession } from '../../domain/models/auth-session'
import type { AuthService } from '../../domain/services/auth-service'

export type Permission = string | PermissionValidator

export type PermissionValidationFn = (v: PermissionValidator) => any

export interface IInstanceWithAuthValidator {
    authValidator: AuthValidator
}

export class AuthValidator {
    constructor(protected readonly authSession: IAuthSession | null, protected readonly authService: AuthService) {}

    static createFromClass(classInstance: IInstanceWithAuthValidator) {
        if (!(classInstance?.authValidator instanceof AuthValidator)) {
            throw new Error(
                'The provided class instance does not have a valid AuthValidator instance. The class must have a property called `authValidator` of type `AuthValidator`.',
            )
        }
        return classInstance.authValidator
    }

    getAuthSession(): IAuthSession | null {
        if (!this.authSession) {
            return null
        }

        return this.authSession
    }

    validateSession(strict: boolean = true) {
        if (this.authSession) {
            const token = this.authSession.jwt

            if (token) {
                const authPayload = this.authService.validateJWT(token)

                if (JSON.stringify(authPayload) === JSON.stringify(this.authSession.jwtPayload)) {
                    return true
                }
            }
        }

        if (strict) {
            throw new UnauthorizedError('You must be logged in to perform this action.')
        } else {
            return false
        }
    }

    validatePermissions(validate: PermissionValidationFn, strict: boolean = true) {
        const isSessionValid = this.validateSession(strict)

        if (!isSessionValid) {
            return false
        }

        const validator = PermissionValidator.create()
        validate(validator)
        if (strict) {
            validator.validate(this.authSession?.claims ?? [])
        } else {
            const results = validator.safeValidate(this.authSession?.claims ?? [])
            return results.valid
        }

        return true
    }
}
