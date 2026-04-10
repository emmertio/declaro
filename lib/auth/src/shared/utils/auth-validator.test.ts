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

        const authValidator = new AuthValidator(session, null, authService)
        const sessionValid = authValidator.validateSession(false)

        expect(sessionValid).toBe(true)
    })

    it('should validate the session with strict mode', async () => {
        const session = getMockAuthSession()
        authService.saveSession(session)

        const authValidator = new AuthValidator(session, null, authService)
        const sessionValid = authValidator.validateSession(true)

        expect(sessionValid).toBe(true)
    })

    it('should return false if session is invalid in non-strict mode', () => {
        const authValidator = new AuthValidator(null, null, authService)

        const sessionValid = authValidator.validateSession(false)
        expect(sessionValid).toBe(false)
    })

    it('should throw an error if session is invalid in strict mode', () => {
        const authValidator = new AuthValidator(null, null, authService)

        expect(() => authValidator.validateSession(true)).toThrow('You must be logged in to perform this action.')
    })

    it('should validate a session with memberships', () => {
        const session = getMockAuthSession()
        authService.saveSession(session)

        const authValidator = new AuthValidator(session, null, authService)
        const sessionValid = authValidator.validateSession(false)

        expect(sessionValid).toBe(true)
        expect(session.memberships).toBeDefined()
        expect(session.memberships.length).toBeGreaterThan(0)
        expect(session.memberships[0].team).toBeDefined()
        expect(session.memberships[0].team.id).toBeDefined()
        expect(session.memberships[0].team.name).toBeDefined()
        expect(session.memberships[0].roles).toBeDefined()
        expect(session.memberships[0].roles?.length).toBeGreaterThan(0)
        expect(session.memberships[0].claims).toBeDefined()
        expect(session.memberships[0].claims?.length).toBeGreaterThan(0)
    })

    it('should validate permissions including team permissions', async () => {
        const session = getMockAuthSession()
        const membership = session.memberships[0]

        const team1Validator = new AuthValidator(session, membership?.team ?? null, authService)

        const hasTeamClaim = team1Validator.validatePermissions((v) => v.someOf(['team-claim-1']))
        const hasBaseClaim = team1Validator.validatePermissions((v) => v.someOf(['claim1']))

        const team2Validator = new AuthValidator(session, session.memberships[1].team ?? null, authService)

        const hasTeamClaim2 = team2Validator.validatePermissions((v) => v.someOf(['team-claim-3']))
        const hasBaseClaim2 = team2Validator.validatePermissions((v) => v.someOf(['claim2']))

        expect(hasTeamClaim).toBe(true)
        expect(hasBaseClaim).toBe(true)
        expect(() => {
            team1Validator.validatePermissions((v) => v.someOf(['team-claim-3']))
        }).toThrow('You do not have any of the required permissions')

        expect(hasTeamClaim2).toBe(true)
        expect(hasBaseClaim2).toBe(true)
        expect(() => {
            team2Validator.validatePermissions((v) => v.someOf(['team-claim-1']))
        }).toThrow('You do not have any of the required permissions')
    })

    it('should validate team permissions', async () => {
        const session = getMockAuthSession()
        authService.saveSession(session)

        const authValidator = new AuthValidator(session, null, authService)
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
