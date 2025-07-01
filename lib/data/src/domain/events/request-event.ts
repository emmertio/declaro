import type { IActionDescriptorInput, Simplify } from '@declaro/core'
import { DomainEvent } from './domain-event'

export interface IRequestEventInput<TInput> {
    input: TInput
}

export class RequestEvent<TResult, TInput, TMeta = any> extends DomainEvent<
    TResult,
    Simplify<IRequestEventInput<TInput> & TMeta>
> {
    constructor(descriptor: IActionDescriptorInput, input: TInput, meta: TMeta = {} as TMeta) {
        super({
            meta: {
                ...meta,
                input,
            },
            descriptor,
        })
    }

    setMeta(meta: Partial<TMeta>): this {
        this.meta = { ...this.meta, ...meta }
        return this
    }

    setResult(result: TResult): this {
        this.data = result

        return this
    }
}
