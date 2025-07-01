import { type AppScope, Context, type RequestScope } from '@declaro/core'
import type { AuthDependencies } from '../../application/auth-context'
import { getMockAuthSession } from '../mock/auth-session'

export async function createTestRequestContext(context: Context<AppScope & AuthDependencies>) {
    // Create a new request context
    const requestContext = new Context<RequestScope & AuthDependencies>()
    requestContext.extend(context)

    requestContext.registerAsyncFactory('authSession', async () => getMockAuthSession())

    return requestContext
}
