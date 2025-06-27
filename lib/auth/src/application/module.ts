import { provideRequestMiddleware, useHeader, type AppScope, type Context, type RequestScope } from '@declaro/core'
import type Redis from 'ioredis'
import type { AuthConfig } from '../domain/interfaces/auth-config'
import { RedisAuthService } from '../infrastructure/impl/redis-auth-service'
import type { AuthDependencies } from './auth-context'

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

        context.registerValue('authSession', null) // Initialize authSession as null

        provideRequestMiddleware(context, async (context: Context<RequestScope>) => {
            const bearer = useHeader(context, 'authorization') as string | undefined
            const token = bearer?.replace(/^(Bearer|bearer)\s+/g, '')
            const authService = await context.scope.authService

            if (token) {
                const authPayload = await authService.validateJWT(token)
                const session = await authService.getSession(authPayload.id)

                context.registerValue('authSession', session)
            }

            context.registerValue('authSession', null) // Initialize authSession as null
        })
    }
}
