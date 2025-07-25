import type { IncomingHttpHeaders } from 'http'
import type { Context, DeclaroScope } from '../context/context'
import { provideRequestMiddleware } from '../http/request-context'

export function useDeclaro() {
    return async (context: Context<DeclaroScope>) => {
        context.registerValue('requestMiddleware', [])
        context.registerValue('nodeMiddleware', [])

        provideRequestMiddleware(context, async (context) => {
            // TODO: Register headers
            // TODO: Support modern web Request type, and Headers instance for full fetch compatibility
            context.registerValue('header', (header: keyof IncomingHttpHeaders) => {
                const headers = context.resolve('headers')
                return headers[header]
            })
        })
    }
}
