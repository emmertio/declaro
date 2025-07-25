import type { AppScope, RequestScope } from '#scope'
import { Context, type DeclaroRequestScope, type DeclaroScope } from '../context/context'
import { provideRequest, type Request } from '../http/request'

declare module '#scope' {
    /**
     * A placeholder for the current application scope.
     * This can be extended to include application-specific values or methods.
     */
    export interface AppScope extends DeclaroScope {}

    /**
     * A placeholder for the current request scope.
     * This can be extended to include request-specific values or methods.
     */
    export interface RequestScope extends DeclaroRequestScope {}
}

export async function createRequestContext(
    appContext: Context<DeclaroScope>,
    request: Request,
): Promise<Context<DeclaroRequestScope>> {
    const context = new Context<DeclaroRequestScope>()
    context.extend(appContext)

    provideRequest(context, request)

    const requestMiddleware = appContext.scope.requestMiddleware
    await context.use(...requestMiddleware)

    await context.initializeEagerDependencies()

    return context
}
