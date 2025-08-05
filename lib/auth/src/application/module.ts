import { provideRequestMiddleware, type Context } from '@declaro/core'
import type Redis from 'ioredis'
import type { AuthConfig } from '../domain/interfaces/auth-config'
import type { IAuthSession } from '../domain/models/auth-session'
import type { AuthService } from '../domain/services/auth-service'
import { RedisAuthService } from '../infrastructure/impl/redis-auth-service'
import { AuthValidator } from '../shared/utils/auth-validator'
import type { AuthRequestScope, AuthScope } from '../types/auth-context'

export function authModule(config: AuthConfig) {
    return (context: Context<AuthScope>) => {
        context.registerValue('authConfig', config)

        context.scope.authSession

        context.registerAsyncFactory(
            'authService',
            async (config: AuthConfig, redis: Redis) => {
                return new RedisAuthService(config, redis)
            },
            ['authConfig', 'redis'],
        )

        context.registerAsyncFactory('authSession', async () => null) // Initialize authSession as null

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
                'authValidator',
                async (authSession: IAuthSession | null, authService: AuthService) => {
                    return new AuthValidator(authSession, authService)
                },
                ['authSession', 'authService'],
            )
        })
    }
}
