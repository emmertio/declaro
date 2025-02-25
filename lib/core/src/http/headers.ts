import { Context } from '../context/context'
import { useRequest } from './request'

export type HeaderMap = Record<string, string>

export function useHeaders(context: Context) {
    const request = useRequest(context)

    return request?.headers ?? {}
}

export function useHeader(context: Context, header: string) {
    const headers = useHeaders(context)

    return headers[header]
}
