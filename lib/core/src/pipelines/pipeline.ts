import type { UnwrapPromise } from '../typescript'
import type { PipelineAction } from './pipeline-action'

export class Pipeline<TFrom, TTo> {
    constructor(protected readonly action: PipelineAction<TFrom, TTo>) {}

    pipe<TModTo>(action: PipelineAction<UnwrapPromise<TTo>, TModTo>): Pipeline<TFrom, TModTo> {
        return new Pipeline<TFrom, TModTo>((input: TFrom) => {
            const output = this.action(input)

            if (output instanceof Promise) {
                return output.then(action) as TModTo
            }

            return action(output as UnwrapPromise<TTo>)
        })
    }

    execute(input: TFrom): TTo {
        return this.action(input)
    }
}
