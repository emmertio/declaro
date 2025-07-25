import { Context } from '@declaro/core'
import type { AuthRequestScope, AuthScope } from '../../types/auth-context'
import { getMockAuthSession } from '../mock/auth-session'

export async function createTestRequestContext<S extends AuthScope>(context: Context<S>) {
    // Create a new request context
    const requestContext = new Context<AuthRequestScope>()
    requestContext.extend(context)

    const middleware = context.scope.requestMiddleware ?? []

    await requestContext.use(...(middleware as any))

    requestContext.registerAsyncFactory('authSession', async () => getMockAuthSession())

    return requestContext
}
