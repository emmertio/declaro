import { Context } from '@declaro/core'
import { beforeAll, describe, expect, it } from 'bun:test'
import { AuthService } from '../domain/services/auth-service'
import { AuthValidator } from '../shared/utils/auth-validator'
import { getMockJWT } from '../test/mock/auth-session'
import { createTestContext, createTestRequestContext } from '../test/utils/test-request'
import type { AuthRequestScope, AuthScope } from '../types/auth-context'
import { authModule } from './module'

describe('Module', () => {
    let context: Context<AuthScope>
    let requestContext: Context<AuthRequestScope>

    const mockJwt = getMockJWT()

    beforeAll(async () => {
        context = await createTestContext()

        requestContext = await createTestRequestContext(context)
    })

    it('should register authConfig', () => {
        expect(context.scope.authConfig).toBeDefined()
        expect(context.scope.authConfig.authTimeout).toBe(3600)
    })

    it('should register authService', async () => {
        expect(await context.scope.authService).toBeInstanceOf(AuthService)
    })

    it('should register authSession as null initially', async () => {
        expect(await context.scope.authSession).toBeNull()
    })

    it('should be able to fetch a session with a valid JWT', async () => {
        const authService = await context.scope.authService
        const session = await authService.createSession({
            jwt: mockJwt,
            claims: ['claim1', 'claim2'],
            roles: ['role1', 'role2'],
        })

        const fetchedSession = await authService.getSession(session.id)
        expect(fetchedSession).toBeDefined()
        expect(fetchedSession?.id).toBe(session.id)
        expect(fetchedSession?.jwt).toBe(session.jwt)
        expect(fetchedSession?.jwtPayload).toBeDefined()
        expect(fetchedSession?.jwtPayload.sid).toBe(session.jwtPayload.sid)
        expect(fetchedSession?.jwtPayload.id).toBe(session.jwtPayload.id)
        expect(fetchedSession?.jwtPayload.email).toBe(session.jwtPayload.email)
        expect(fetchedSession?.jwtPayload.nickname).toBe(session.jwtPayload.nickname)
        expect(fetchedSession?.jwtPayload.given_name).toBe(session.jwtPayload.given_name!)
        expect(fetchedSession?.jwtPayload.family_name).toBe(session.jwtPayload.family_name!)
        expect(fetchedSession?.jwtPayload.name).toBe(session.jwtPayload.name)
        expect(fetchedSession?.expires).toBeInstanceOf(Date)
        expect(fetchedSession?.issued).toBeInstanceOf(Date)
        expect(fetchedSession?.roles).toEqual(['role1', 'role2'])
        expect(fetchedSession?.claims).toEqual(['claim1', 'claim2'])
    })

    it('should provide authSession in request context', async () => {
        const authSession = await requestContext.scope.authSession
        expect(authSession).toBeDefined()

        expect(authSession?.id).toBeDefined()
        expect(authSession?.jwt?.length).toBeGreaterThanOrEqual(10)
        expect(authSession?.jwtPayload).toBeDefined()
        expect(authSession?.jwtPayload.sid).toBeDefined()
        expect(authSession?.jwtPayload.email).toBe('test@emmert.io')
        expect(authSession?.jwtPayload.nickname).toBe('Test User')
        expect(authSession?.jwtPayload.given_name).toBe('Test')
        expect(authSession?.jwtPayload.family_name).toBe('User')
        expect(authSession?.jwtPayload.name).toBe('Test User')
        expect(authSession?.expires).toBeInstanceOf(Date)
        expect(authSession?.issued).toBeInstanceOf(Date)
        expect(authSession?.roles).toEqual(['role1', 'role2'])
        expect(authSession?.claims).toEqual(['claim1', 'claim2'])
    })

    it('should provide authValidator in request context', async () => {
        const authValidator = await requestContext.scope.authValidator
        expect(authValidator).toBeDefined()
        expect(authValidator).toBeInstanceOf(AuthValidator)

        const authSession = await requestContext.scope.authSession
        expect(authValidator.getAuthSession()?.id).toEqual(authSession?.id!)

        const isValid = authValidator.validateSession(false)
        expect(isValid).toBe(true)
    })
})
