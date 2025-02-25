import { Context } from '../context/context'
import type { IncomingMessage } from 'http'

export const REQUEST = Symbol('declaro:request')

export interface Request extends IncomingMessage {}

export function provideRequest(context: Context, request: Request) {
    context.provide(REQUEST, request)
}

export function useRequest(context: Context) {
    const request = context.inject<Request | undefined>(REQUEST)

    return request
}

export function useRequestMethod(context: Context) {
    const request = useRequest(context)

    return request?.method
}
