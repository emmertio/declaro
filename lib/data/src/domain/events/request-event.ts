import type { IActionDescriptorInput, Simplify } from '@declaro/core'
import { DomainEvent } from './domain-event'

export interface IRequestEventMeta {}

export interface IRequestEventJSON<TInput, TMeta = IRequestEventMeta> extends Simplify<DomainEvent<TInput, TMeta>> {
    input: TInput
}

export class RequestEvent<TResult, TInput, TMeta extends IRequestEventMeta = IRequestEventMeta> extends DomainEvent<
    TResult,
    TMeta
> {
    input: TInput

    constructor(descriptor: IActionDescriptorInput, input: TInput, meta: TMeta = {} as TMeta) {
        super({
            meta,
            descriptor,
        })

        this.input = input
    }

    setInput(input: TInput): this {
        this.input = input
        return this
    }

    setMeta(meta: Partial<TMeta>): this {
        this.meta = { ...this.meta, ...meta }
        return this
    }

    setResult(result: TResult): this {
        this.data = result

        return this
    }

    toJSON() {
        return {
            ...super.toJSON(),
            input: this.input,
        }
    }
}
