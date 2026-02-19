import type { IncomingMessage, ServerResponse } from 'http'
import { Context, type ContextMiddleware, type DeclaroScope } from '../context/context'

/**
 * Get the request middleware for the current context.
 * @param context The context to retrieve middleware from.
 * @returns An array of request middleware functions.
 * @deprecated Use `context.scope.requestMiddleware` instead.
 */
export function useRequestMiddleware<S extends DeclaroScope>(context: Context<S>) {
    const middleware = context.resolve('requestMiddleware', {
        strict: false,
    })

    return middleware ?? []
}

export function provideRequestMiddleware<S extends DeclaroScope>(
    context: Context<S>,
    ...middleware: ContextMiddleware<Context>[]
) {
    const existingMiddleware = context.scope.requestMiddleware ?? []

    const extendedMiddleware = [...existingMiddleware, ...middleware]

    context.registerValue('requestMiddleware', extendedMiddleware as any)

    return extendedMiddleware
}

export type NodeListener = (req: IncomingMessage, res: ServerResponse) => void
export type NodePromisifiedHandler = (req: IncomingMessage, res: ServerResponse) => Promise<any>
export type NodeMiddleware = (req: IncomingMessage, res: ServerResponse, next: (err?: Error) => any) => any
export type AllNodeMiddleware = NodeListener | NodePromisifiedHandler | NodeMiddleware

export function useNodeMiddleware<S extends DeclaroScope>(context: Context<S>) {
    const middleware = context.resolve('nodeMiddleware', {
        strict: false,
    })

    return middleware ?? []
}

export function provideNodeMiddleware<S extends DeclaroScope>(context: Context<S>, ...middleware: AllNodeMiddleware[]) {
    const existingMiddleware = useNodeMiddleware(context)

    const extendedMiddleware = [...existingMiddleware, ...middleware]

    context.registerValue('nodeMiddleware', extendedMiddleware)

    return extendedMiddleware
}
