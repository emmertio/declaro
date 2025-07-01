import type { IActionDescriptorInput } from '@declaro/core'
import { RequestEvent } from './request-event'

export class QueryEvent<TResult, TParams, TMeta = any> extends RequestEvent<TResult, TParams, TMeta> {
    constructor(descriptor: IActionDescriptorInput, params: TParams, meta: TMeta = {} as TMeta) {
        super(descriptor, params, meta)
    }
}
