import type { IActionDescriptorInput } from '@declaro/core'
import { RequestEvent, type IRequestEventMeta } from './request-event'

export interface IMutationEventMeta<TResult> extends IRequestEventMeta {
    existing?: TResult
}

export class MutationEvent<
    TResult,
    TInput,
    TMeta extends IMutationEventMeta<TResult> = IMutationEventMeta<TResult>,
> extends RequestEvent<TResult, TInput, TMeta> {
    constructor(descriptor: IActionDescriptorInput, input: TInput, meta: TMeta = {} as TMeta) {
        super(descriptor, input, meta)
    }
}
