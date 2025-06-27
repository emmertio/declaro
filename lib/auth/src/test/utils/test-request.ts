import { type AppScope, Context, type RequestScope } from '@declaro/core'
import type { AuthDependencies } from '../../application/auth-context'
import { mockAuthSession } from '../mock/auth-session'

export async function createTestRequestContext(context: Context<AppScope & AuthDependencies>) {
    // Create a new request context
    const requestContext = new Context<RequestScope & AuthDependencies>()
    requestContext.extend(context)

    requestContext.registerValue('authSession', mockAuthSession)

    return requestContext
}
