import { Context } from '../context/context'
import { URL } from 'whatwg-url'
import { useRequest } from './request'

export function useRequestURL(context: Context): URL | undefined {
    const request = useRequest(context)
    const url = request?.url && new URL(request?.url)

    return url as URL
}

export function useRequestURLString(context: Context) {
    const url = useRequestURL(context)

    return url?.toString()
}

export function useRequestDomain(context: Context) {
    const url = useRequestURL(context)

    return url?.hostname
}

export function useRequestPath(context: Context) {
    const url = useRequestURL(context)

    return url?.pathname
}

export function useRequestQuery(context: Context): Record<string, string> {
    const url = useRequestURL(context)

    const qs = url?.searchParams

    // convert qs to an object of key value pairs
    const qsMap = [...(qs?.entries() as any)].reduce((qsMap, [key, value]) => {
        qsMap[key] = value
        return qsMap
    }, {} as Record<string, string>)

    return qsMap
}

export function useFormattedQueryParam(context: Context, key: string) {
    const qs = useRequestQuery(context)

    const value = qs[key]
}
