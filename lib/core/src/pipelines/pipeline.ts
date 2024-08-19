import type { UnwrapPromise } from '../typescript'
import { pipelineAction, type ActionOutput, type PipelineAction } from './pipeline-action'

export function initialInput<T>(input?: T) {
    return pipelineAction((input: T) => input)
}

export type PipelineOutput<T extends Pipeline<any, any>> = T extends Pipeline<any, infer U> ? U : never
export type PipelineInput<T extends Pipeline<any, any>> = T extends Pipeline<infer U, any> ? U : never

export type DivergedOutput<TFrom, P extends PipelineAction<TFrom, any>> = ActionOutput<P>
export type DivergeDecision<TFrom, TAction extends PipelineAction<TFrom, any>> = (input: TFrom) => TAction

/**
 * A pipeline is a series of actions that are executed in sequence, with the output of each action being passed as input to the next action.
 */
export class Pipeline<TFrom, TTo> {
    constructor(protected readonly _action: PipelineAction<TFrom, TTo>) {}

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
            const output = this._action(input)

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
        return this._action(input)
    }

    export(): PipelineAction<TFrom, TTo> {
        return this._action
    }

    diverge<TAction extends PipelineAction<UnwrapPromise<TTo>, any>>(
        decision: DivergeDecision<UnwrapPromise<TTo>, TAction>,
    ): Pipeline<TFrom, DivergedOutput<UnwrapPromise<TTo>, TAction>> {
        return this.pipe((input) => {
            const action = decision(input)

            if (action instanceof Promise) {
                return action.then((action) => action(input)) as DivergedOutput<UnwrapPromise<TTo>, TAction>
            }

            return action(input)
        })
    }
}
