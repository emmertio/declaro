import type { UnwrapPromise } from '../typescript'
import type { PipelineAction } from './pipeline-action'

/**
 * A pipeline is a series of actions that are executed in sequence, with the output of each action being passed as input to the next action.
 */
export class Pipeline<TFrom, TTo> {
    constructor(protected readonly action: PipelineAction<TFrom, TTo>) {}

    /**
     * Adds a new action to the pipeline.
     *
     * @param action A function that takes the output of the current pipeline and returns a new output. Async actions are automatically awaited, and will be passed the resolved output of the current pipeline.
     * @returns A new pipeline that includes the current pipeline and the new action.
     *
     * NOTE: Downstream outputs must be a Promise if the current output is a Promise.
     */
    pipe<TModTo>(action: PipelineAction<UnwrapPromise<TTo>, TModTo>): Pipeline<TFrom, TModTo> {
        return new Pipeline<TFrom, TModTo>((input: TFrom) => {
            const output = this.action(input)

            if (output instanceof Promise) {
                return output.then(action) as TModTo
            }

            return action(output as UnwrapPromise<TTo>)
        })
    }

    /**
     * Executes the pipeline with the given input. If the pipeline contains async actions, the result will be a Promise.
     *
     * @param input The input to the first action in the pipeline.
     * @returns The output of the last action in the pipeline.
     */
    execute(input: TFrom): TTo {
        return this.action(input)
    }
}
