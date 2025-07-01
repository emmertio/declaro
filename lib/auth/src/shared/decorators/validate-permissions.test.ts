import { PermissionError } from '@declaro/core'
import { beforeEach, describe, expect, it } from 'bun:test'
import { MockAuthService } from '../../test/mock/auth-service'
import { getMockAuthSession } from '../../test/mock/auth-session'
import { AuthValidator } from '../utils/auth-validator'
import { ValidatePermissions } from './validate-permissions'

class MyController {
    constructor(protected readonly authValidator: AuthValidator) {}

    @ValidatePermissions((v) =>
        v.someOf(['permission-1', 'permission-2']).allOf(['required-permission-1', 'required-permission-2']),
    )
    foo() {
        return 'bar'
    }
}

const validPermissions = ['permission-1', 'required-permission-1', 'required-permission-2']
const missingRequiredPermissions = ['permission-1', 'required-permission-1']
const missingAllOptionalPermissions = ['required-permission-1', 'required-permission-2']

describe('ValidatePermissions Decorator', () => {
    const authService = new MockAuthService({
        authTimeout: 3600,
    })

    beforeEach(() => {})

    it('should execute the method if permissions are valid', () => {
        const controller = new MyController(
            new AuthValidator(
                getMockAuthSession({
                    claims: validPermissions,
                }),
                authService,
            ),
        )

        const result = controller.foo()
        expect(result).toBe('bar')
    })

    it('should throw UnauthorizedError if required permissions are missing', () => {
        const controller = new MyController(
            new AuthValidator(getMockAuthSession({ claims: missingRequiredPermissions }), authService),
        )

        expect(() => controller.foo()).toThrow(PermissionError)
        expect(() => controller.foo()).toThrow('You do not have the required permissions')
    })

    it('should throw UnauthorizedError if all optional permissions are all missing', () => {
        const controller = new MyController(
            new AuthValidator(getMockAuthSession({ claims: missingAllOptionalPermissions }), authService),
        )

        expect(() => controller.foo()).toThrow(PermissionError)
        expect(() => controller.foo()).toThrow('You do not have any of the required permissions')
    })

    it('should throw an error if the decorator is applied to a method on a class without authValidator', () => {
        class InvalidController {
            @ValidatePermissions((v) =>
                v.someOf(['permission-1', 'permission-2']).allOf(['required-permission-1', 'required-permission-2']),
            )
            foo() {
                return 'bar'
            }
        }

        const invalidController = new InvalidController()

        expect(() => {
            invalidController.foo()
        }).toThrow(
            'The provided class instance does not have a valid AuthValidator instance. The class must have a property called `authValidator` of type `AuthValidator`.',
        )
    })
})
