import type { IActionDescriptorInput } from '@declaro/core'
import { RequestEvent, type IRequestEventMeta } from './request-event'

export interface IQueryEventMeta<TResult> extends IRequestEventMeta {}

export class QueryEvent<
    TResult,
    TParams,
    TMeta extends IQueryEventMeta<TResult> = IQueryEventMeta<TResult>,
> extends RequestEvent<TResult, TParams, TMeta> {
    constructor(descriptor: IActionDescriptorInput, params: TParams, meta: TMeta = {} as TMeta) {
        super(descriptor, params, meta)
    }
}
