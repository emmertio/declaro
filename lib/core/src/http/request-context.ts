import type { IncomingMessage, ServerResponse } from 'http'
import { Context, type ContextMiddleware, type DeclaroScope } from '../context/context'

import type { RequestScope, AppScope } from '#scope'

/**
 * Get the request middleware for the current context.
 * @param context The context to retrieve middleware from.
 * @returns An array of request middleware functions.
 * @deprecated Use `context.scope.requestMiddleware` instead.
 */
export function useRequestMiddleware(context: Context<DeclaroScope>) {
    const middleware = context.resolve('requestMiddleware', {
        strict: false,
    })

    return middleware ?? []
}

export function provideRequestMiddleware<
    RC extends Context = Context<RequestScope>,
    C extends Context = Context<AppScope>,
>(context: C, ...middleware: ContextMiddleware<RC>[]) {
    const existingMiddleware = useRequestMiddleware(context)

    const extendedMiddleware = [...existingMiddleware, ...middleware]

    context.registerValue('requestMiddleware', extendedMiddleware)

    return extendedMiddleware
}

export type NodeListener = (req: IncomingMessage, res: ServerResponse) => void
export type NodePromisifiedHandler = (req: IncomingMessage, res: ServerResponse) => Promise<any>
export type NodeMiddleware = (req: IncomingMessage, res: ServerResponse, next: (err?: Error) => any) => any
export type AllNodeMiddleware = NodeListener | NodePromisifiedHandler | NodeMiddleware

export function useNodeMiddleware(context: Context<AppScope>) {
    const middleware = context.resolve('nodeMiddleware', {
        strict: false,
    })

    return middleware ?? []
}

export function provideNodeMiddleware(context: Context<AppScope>, ...middleware: AllNodeMiddleware[]) {
    const existingMiddleware = useNodeMiddleware(context)

    const extendedMiddleware = [...existingMiddleware, ...middleware]

    context.registerValue('nodeMiddleware', extendedMiddleware)

    return extendedMiddleware
}
