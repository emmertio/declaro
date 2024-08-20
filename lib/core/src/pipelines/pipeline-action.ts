export type PipelineAction<TFrom, TTo> = (input: TFrom) => TTo
export type ActionOutput<TAction extends PipelineAction<any, any>> = TAction extends PipelineAction<any, infer U>
    ? U
    : never
export type ActionInput<TAction extends PipelineAction<any, any>> = TAction extends PipelineAction<infer U, any>
    ? U
    : never

export type PipelineDecision<TFrom, TAction extends PipelineAction<TFrom, any>> = (input: TFrom) => TAction

export function pipelineAction<TFrom, TTo>(action: PipelineAction<TFrom, TTo>) {
    return action
}
