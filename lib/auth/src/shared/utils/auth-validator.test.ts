import { beforeAll, describe, expect, it } from 'bun:test'
import { AuthService } from '../../domain/services/auth-service'
import { MockAuthService } from '../../test/mock/auth-service'
import { AuthValidator } from './auth-validator'
import { getMockAuthSession } from '../../test/mock/auth-session'

describe('AuthValidator', () => {
    let authService: AuthService

    beforeAll(() => {
        authService = new MockAuthService({
            authTimeout: 3600,
        })
    })

    it('should validate the session with non-strict mode', async () => {
        const session = getMockAuthSession()
        authService.saveSession(session)

        const authValidator = new AuthValidator(session, authService)
        const sessionValid = authValidator.validateSession(false)

        expect(sessionValid).toBe(true)
    })

    it('should validate the session with strict mode', async () => {
        const session = getMockAuthSession()
        authService.saveSession(session)

        const authValidator = new AuthValidator(session, authService)
        const sessionValid = authValidator.validateSession(true)

        expect(sessionValid).toBe(true)
    })

    it('should return false if session is invalid in non-strict mode', () => {
        const authValidator = new AuthValidator(null, authService)

        const sessionValid = authValidator.validateSession(false)
        expect(sessionValid).toBe(false)
    })

    it('should throw an error if session is invalid in strict mode', () => {
        const authValidator = new AuthValidator(null, authService)

        expect(() => authValidator.validateSession(true)).toThrow('You must be logged in to perform this action.')
    })
})
