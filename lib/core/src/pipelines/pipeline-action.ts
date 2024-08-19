export type PipelineAction<TFrom, TTo> = (input: TFrom) => TTo

export function pipelineAction<TFrom, TTo>(action: PipelineAction<TFrom, TTo>) {
    return action
}
