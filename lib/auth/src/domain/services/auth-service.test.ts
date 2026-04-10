import { beforeAll, describe, expect, it } from 'bun:test'
import type { AuthService } from './auth-service'
import { MockAuthService } from '../../test/mock/auth-service'
import { mockAuthConfig } from '../../test/mock/auth-config'
import { getMockAuthPayload, getMockJWT } from '../../test/mock/auth-session'

describe('AuthService', () => {
    let authService: AuthService
    const mockJwt = getMockJWT()

    beforeAll(() => {
        authService = new MockAuthService(mockAuthConfig)
    })

    it('should create a session ID', () => {
        const sessionId = authService.getSessionId()
        expect(sessionId).toBeDefined()
        expect(sessionId.startsWith('auth-session-')).toBe(true)
    })

    it('should create a session ID with an existing ID', () => {
        const existingId = 'auth-session-existing-session-id'
        const sessionId = authService.getSessionId({ id: existingId, jwt: '' })
        expect(sessionId).toBeDefined()
        expect(sessionId).toBe(existingId)
    })

    it('should create a valid auth session', async () => {
        const session = await authService.createSession({
            jwt: mockJwt,
            claims: ['claim1', 'claim2'],
            roles: ['role1', 'role2'],
        })

        const mockPayload = getMockAuthPayload()

        expect(session.id).toBeDefined()
        expect(session.jwt).toBe(mockJwt)
        expect(session.jwtPayload).toBeDefined()
        expect(session.jwtPayload.sid).toBe(mockPayload.sid)
        expect(session.jwtPayload.id).toBe(mockPayload.id)
        expect(session.jwtPayload.email).toBe(mockPayload.email)
        expect(session.jwtPayload.nickname).toBe(mockPayload.nickname)
        expect(session.jwtPayload.given_name).toBe(mockPayload.given_name!)
        expect(session.jwtPayload.family_name).toBe(mockPayload.family_name!)
        expect(session.jwtPayload.name).toBe(mockPayload.name)
        expect(session.expires).toBeInstanceOf(Date)
        expect(session.issued).toBeInstanceOf(Date)
        expect(session.roles).toEqual(['role1', 'role2'])
        expect(session.claims).toEqual(['claim1', 'claim2'])
    })

    it('should be able to load a jwt', async () => {
        const sessionId = authService.getSessionId()

        await authService.createSession({
            id: sessionId,
            jwt: mockJwt,
            claims: ['claim1', 'claim2'],
            roles: ['role1', 'role2'],
        })

        const mockPayload = getMockAuthPayload()

        const session = await authService.getSession(sessionId)
        expect(session).toBeDefined()
        expect(session?.id).toBe(sessionId)
        expect(session?.jwt).toBe(mockJwt)
        expect(session?.jwtPayload).toBeDefined()
        expect(session?.jwtPayload.sid).toBe(mockPayload.sid)
        expect(session?.jwtPayload.email).toBe(mockPayload.email)
        expect(session?.jwtPayload.nickname).toBe(mockPayload.nickname)
        expect(session?.jwtPayload.given_name).toBe(mockPayload.given_name!)
        expect(session?.jwtPayload.family_name).toBe(mockPayload.family_name!)
        expect(session?.jwtPayload.name).toBe(mockPayload.name)
        expect(session?.expires).toBeInstanceOf(Date)
        expect(session?.issued).toBeInstanceOf(Date)
        expect(session?.roles).toEqual(['role1', 'role2'])
        expect(session?.claims).toEqual(['claim1', 'claim2'])
    })

    it('should create a session with an expiration date in the future according to authConfig', async () => {
        const before = new Date()
        const session = await authService.createSession({
            jwt: mockJwt,
            claims: ['claim1', 'claim2'],
            roles: ['role1', 'role2'],
        })
        const after = new Date()

        expect(session.issued).toBeInstanceOf(Date)
        expect(session.issued.getTime()).toBeGreaterThanOrEqual(before.getTime())
        expect(session.issued.getTime()).toBeLessThanOrEqual(after.getTime())

        expect(session.expires).toBeInstanceOf(Date)
        expect(session.expires.getTime()).toBeGreaterThanOrEqual(
            session.issued.getTime() + mockAuthConfig.authTimeout * 1000,
        )
        expect(session.expires.getTime()).toBeLessThanOrEqual(
            new Date(after.getTime() + mockAuthConfig.authTimeout * 1000).getTime(),
        )
    })
})
