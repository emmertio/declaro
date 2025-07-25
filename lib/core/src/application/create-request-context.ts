import { Context, type DeclaroRequestScope, type DeclaroScope } from '../context/context'
import { provideRequest, type Request } from '../http/request'

export async function createRequestContext<S extends DeclaroScope>(
    appContext: Context<S>,
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
