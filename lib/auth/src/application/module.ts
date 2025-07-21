import { provideRequestMiddleware, useHeader, type AppScope, type Context, type RequestScope } from '@declaro/core'
import type Redis from 'ioredis'
import type { AuthConfig } from '../domain/interfaces/auth-config'
import { RedisAuthService } from '../infrastructure/impl/redis-auth-service'
import type { AuthDependencies } from './auth-dependencies'
import type { AuthService } from '../domain/services/auth-service'
import '../types/auth-context' // Ensure types are added to AppScope and RequestScope
import { AuthValidator } from '../shared/utils/auth-validator'
import type { IAuthSession } from '../domain/models/auth-session'

export function authModule(config: AuthConfig) {
    return (context: Context<AppScope & AuthDependencies>) => {
        context.registerValue('authConfig', config)

        context.registerAsyncFactory(
            'authService',
            async (config: AuthConfig, redis: Redis) => {
                return new RedisAuthService(config, redis)
            },
            ['authConfig', 'redis'],
        )

        context.registerAsyncFactory('authSession', async () => null) // Initialize authSession as null

        provideRequestMiddleware(context, async (context: Context<RequestScope>) => {
            context.registerAsyncFactory(
                'authSession',
                async (authService: AuthService) => {
                    const bearer = context.scope.header('authorization')
                    const token = bearer?.replace(/^(Bearer|bearer)\s+/g, '')

                    if (token) {
                        const authPayload = authService.validateJWT(token)
                        const session = await authService.getSession(authPayload.id)

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
