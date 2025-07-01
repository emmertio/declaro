import type { IActionDescriptorInput } from '@declaro/core'
import { RequestEvent } from './request-event'

export class MutationEvent<TResult, TInput, TMeta = any> extends RequestEvent<TResult, TInput, TMeta> {
    constructor(descriptor: IActionDescriptorInput, input: TInput, meta: TMeta = {} as TMeta) {
        super(descriptor, input, meta)
    }
}
