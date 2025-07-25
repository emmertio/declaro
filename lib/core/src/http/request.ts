import type { IncomingMessage } from 'http'
import { Context, type DeclaroRequestScope } from '../context/context'

export interface Request extends IncomingMessage {}

export function provideRequest(context: Context<DeclaroRequestScope>, request: Request) {
    context.registerValue('request', request)
}

/**
 * Get the request from the context.
 *
 * @deprecated You can now inject the request directly from Context<RequestScope>.
 * This function will be removed in a future version.
 * @param context The context to use for the request.
 * @returns
 */
export function useRequest(context: Context) {
    const request = context.resolve('request')

    return request
}

/**
 * Get the HTTP method of the request.
 *
 * @deprecated You can now inject the request directly from Context<RequestScope>.
 * This function will be removed in a future version.
 * @param context The context to use for the request.
 * @returns The HTTP method of the request, or undefined if not available.
 */
export function useRequestMethod(context: Context) {
    const request = useRequest(context)

    return request?.method
}
