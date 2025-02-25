import { Context, type ContextMiddleware } from '../context/context'
import type { IncomingMessage, ServerResponse } from 'http'

export const REQUEST_CONTEXT_MIDDLEWARE = Symbol('declaro:request-context-middleware')

export function useRequestMiddleware(context: Context) {
    const middleware = context.inject<ContextMiddleware[]>(REQUEST_CONTEXT_MIDDLEWARE)

    return middleware ?? []
}

export function provideRequestMiddleware(context: Context, ...middleware: ContextMiddleware[]) {
    const existingMiddleware = useRequestMiddleware(context)

    const extendedMiddleware = [...existingMiddleware, ...middleware]

    context.provide(REQUEST_CONTEXT_MIDDLEWARE, extendedMiddleware)

    return extendedMiddleware
}

export const REQUEST_NODE_MIDDLEWARE = Symbol('declaro:request-node-middleware')

export type NodeListener = (req: IncomingMessage, res: ServerResponse) => void
export type NodePromisifiedHandler = (req: IncomingMessage, res: ServerResponse) => Promise<any>
export type NodeMiddleware = (req: IncomingMessage, res: ServerResponse, next: (err?: Error) => any) => any
export type AllNodeMiddleware = NodeListener | NodePromisifiedHandler | NodeMiddleware

export function useNodeMiddleware(context: Context) {
    const middleware = context.inject<AllNodeMiddleware[]>(REQUEST_NODE_MIDDLEWARE)

    return middleware ?? []
}

export function provideNodeMiddleware(context: Context, ...middleware: AllNodeMiddleware[]) {
    const existingMiddleware = useNodeMiddleware(context)

    const extendedMiddleware = [...existingMiddleware, ...middleware]

    context.provide(REQUEST_NODE_MIDDLEWARE, extendedMiddleware)

    return extendedMiddleware
}
