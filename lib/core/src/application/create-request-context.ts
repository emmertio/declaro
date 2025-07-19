import { Context, type AppScope, type RequestScope } from '../context/context'
import { provideRequest } from '../http/request'
import { type Request } from '../http/request'

export async function createRequestContext(
    appContext: Context<AppScope>,
    request: Request,
): Promise<Context<RequestScope>> {
    const context = new Context<RequestScope>()
    context.extend(appContext)

    provideRequest(context, request)

    const requestMiddleware = appContext.scope.requestMiddleware
    await context.use(...requestMiddleware)

    await context.initializeEagerDependencies()

    return context
}
