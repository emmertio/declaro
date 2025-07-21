import { Context, type AppScope, type RequestScope } from '@declaro/core'
import { beforeAll, describe, expect, it } from 'bun:test'
import type { AuthDependencies } from './auth-dependencies'
import { authModule } from './module'
import { AuthService } from '../domain/services/auth-service'
import { createTestRequestContext } from '../test/utils/test-request'
import { getMockJWT } from '../test/mock/auth-session'
import { AuthValidator } from '../shared/utils/auth-validator'

describe('Module', () => {
    let context: Context<AppScope & AuthDependencies>
    let requestContext: Context<RequestScope & AuthDependencies>

    const mockJwt = getMockJWT()

    beforeAll(async () => {
        context = new Context()
        await context.use(
            authModule({
                authTimeout: 3600, // 1 hour
            }),
        )

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

    it('should provide authSession in request context', async () => {
        const authSession = await requestContext.scope.authSession
        expect(authSession).toBeDefined()

        expect(authSession?.id).toBeDefined()
        expect(authSession?.jwt?.length).toBeGreaterThanOrEqual(10)
        expect(authSession?.jwtPayload).toBeDefined()
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
