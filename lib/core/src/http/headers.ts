import { Context, type RequestScope } from '../context/context'
import { useRequest } from './request'

/**
 * Get the headers from the request.
 *
 * @deprecated You can now inject headers directly from Context<RequestScope>.
 * This function will be removed in a future version.
 * @param context The context to use for the request.
 * @returns The headers of the request, or an empty object if not available.
 */
export function useHeaders(context: Context<RequestScope>) {
    const request = useRequest(context)

    return request?.headers ?? {}
}

/**
 * Get a specific header from the request.
 *
 * @deprecated You can now inject headers directly from Context<RequestScope>.
 * This function will be removed in a future version.
 * @param context The context to use for the request.
 * @param header The name of the header to retrieve.
 * @returns The value of the specified header, or undefined if not available.
 */
export function useHeader(context: Context<RequestScope>, header: string) {
    const headers = useHeaders(context)

    return headers[header]
}
