import type { IncomingMessage, ServerResponse } from 'http'
import { Context, type AppScope, type ContextMiddleware, type RequestScope } from '../context/context'

export function useRequestMiddleware(context: Context<AppScope>) {
    const middleware = context.resolve('requestMiddleware', {
        strict: false,
    })

    return middleware ?? []
}

export function provideRequestMiddleware<C extends Context>(
    context: C,
    ...middleware: ContextMiddleware<Context<RequestScope>>[]
) {
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
