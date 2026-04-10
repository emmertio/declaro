import { ForbiddenError, provideRequestMiddleware, type Context } from '@declaro/core'
import type Redis from 'ioredis'
import type { AuthConfig } from '../domain/interfaces/auth-config'
import type { IAuthMembershipSummary, IAuthSession } from '../domain/models/auth-session'
import type { AuthService } from '../domain/services/auth-service'
import { RedisAuthService } from '../infrastructure/impl/redis-auth-service'
import { AuthValidator } from '../shared/utils/auth-validator'
import type { AuthRequestScope, AuthScope } from '../types/auth-context'

export function authModule(config: AuthConfig) {
    return (context: Context<AuthScope>) => {
        context.registerValue('authConfig', config)

        context.registerAsyncFactory(
            'authService',
            async (config: AuthConfig, redis: Redis) => {
                return new RedisAuthService(config, redis)
            },
            ['authConfig', 'redis'],
        )

        context.registerAsyncFactory('authSession', async () => null) // Initialize authSession as null

        context.registerAsyncFactory('authMembership', async () => null) // Initialize authMembership as null

        provideRequestMiddleware(context, async (context: Context<AuthRequestScope>) => {
            context.registerAsyncFactory(
                'authSession',
                async (authService: AuthService) => {
                    const bearer = context.scope.header('authorization')
                    const token = bearer?.replace(/^(Bearer|bearer)\s+/g, '')

                    if (token) {
                        const authPayload = authService.validateJWT(token)
                        const session = await authService.getSession(authPayload.sid)

                        return session ?? null
                    }

                    return null
                },
                ['authService'],
            )

            context.registerAsyncFactory(
                'authMembership',
                async (authSession: IAuthSession | null) => {
                    if (!authSession) return null

                    const teamHeader = context.scope.header('x-team')

                    if (typeof teamHeader !== 'string') {
                        return null
                    }

                    const membership = authSession.memberships?.find((m) => m.team.id === teamHeader?.trim()) ?? null

                    if (teamHeader && !membership) {
                        throw new ForbiddenError('User is not a member of the specified team')
                    }

                    return membership
                },
                ['authSession'],
            )

            context.registerAsyncFactory(
                'authValidator',
                async (
                    authSession: IAuthSession | null,
                    authMembership: IAuthMembershipSummary | null,
                    authService: AuthService,
                ) => {
                    return new AuthValidator(authSession, authMembership?.team ?? null, authService)
                },
                ['authSession', 'authMembership', 'authService'],
            )
        })
    }
}
