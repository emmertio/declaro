import { Context } from '@declaro/core'
import type { AuthRequestScope, AuthScope } from '../../types/auth-context'
import { getMockAuthSession } from '../mock/auth-session'
import { authModule } from '../../application/module'
import Redis from 'ioredis-mock' // Import to ensure types are available

export async function createTestContext() {
    const context = new Context<AuthScope>()

    context.registerValue('authConfig', {
        authTimeout: 3600, // 1 hour
    })

    context.registerAsyncFactory('redis', async () => {
        return new Redis()
    })

    await context.use(
        authModule({
            authTimeout: 3600, // 1 hour
        }),
    )

    return context
}

export async function createTestRequestContext<S extends AuthScope>(context?: Context<S>) {
    const baseContext = context ?? (await createTestContext())
    // Create a new request context
    const requestContext = new Context<AuthRequestScope>()
    requestContext.extend(baseContext)

    const middleware = baseContext.scope.requestMiddleware ?? []

    await requestContext.use(...(middleware as any))

    requestContext.registerAsyncFactory('authSession', async () => getMockAuthSession())

    return requestContext
}
