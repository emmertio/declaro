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

    it('should validate a session with memberships', () => {
        const session = getMockAuthSession()
        authService.saveSession(session)

        const authValidator = new AuthValidator(session, authService)
        const sessionValid = authValidator.validateSession(false)

        expect(sessionValid).toBe(true)
        expect(session.memberships).toBeDefined()
        expect(session.memberships.length).toBeGreaterThan(0)
        expect(session.memberships[0].team).toBeDefined()
        expect(session.memberships[0].team.id).toBeDefined()
        expect(session.memberships[0].team.name).toBeDefined()
    })

    it('should validate team permissions', async () => {
        const session = getMockAuthSession()
        authService.saveSession(session)

        const authValidator = new AuthValidator(session, authService)
        const sessionValid = authValidator.validateTeamPermissions(session.memberships[0].team.id, (v) =>
            v.someOf(['team-claim-1']),
        )
        const sessionInvalid = authValidator.validateTeamPermissions(
            session.memberships[0].team.id,
            (v) => v.someOf(['missing-claim']),
            false,
        )

        expect(sessionValid).toBe(true)
        expect(sessionInvalid).toBe(false)
        expect(() => {
            authValidator.validateTeamPermissions(session.memberships[0].team.id, (v) => v.someOf(['missing-claim']))
        }).toThrow('You do not have any of the required permissions')
    })
})
