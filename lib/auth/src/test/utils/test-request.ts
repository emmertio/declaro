import { type AppScope, Context, type RequestScope } from '@declaro/core'
import type { AuthDependencies } from '../../application/auth-dependencies'
import { getMockAuthSession } from '../mock/auth-session'

export async function createTestRequestContext(context: Context<AppScope & AuthDependencies>) {
    // Create a new request context
    const requestContext = new Context<RequestScope & AuthDependencies>()
    requestContext.extend(context)

    const middleware = context.scope.requestMiddleware ?? []

    await requestContext.use(...(middleware as any))

    requestContext.registerAsyncFactory('authSession', async () => getMockAuthSession())

    return requestContext
}
