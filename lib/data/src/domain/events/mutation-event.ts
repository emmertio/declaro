import type { IActionDescriptorInput } from '@declaro/core'
import { RequestEvent, type IRequestEventMeta } from './request-event'

export interface IMutationEventMeta<TResult> extends IRequestEventMeta {
    existing?: TResult
}

export interface ICreateEventMeta<TResult, TInput> extends IMutationEventMeta<TResult> {
    args?: {
        input: TInput
        options?: Record<string, unknown>
    }
}

export interface IUpdateEventMeta<TResult, TLookup, TInput> extends IMutationEventMeta<TResult> {
    args?: {
        lookup: TLookup
        input: TInput
        options?: Record<string, unknown>
    }
}

export interface IRemoveEventMeta<TResult, TLookup> extends IMutationEventMeta<TResult> {
    args?: {
        lookup: TLookup
        options?: Record<string, unknown>
    }
}

export interface IRestoreEventMeta<TResult, TLookup> extends IMutationEventMeta<TResult> {
    args?: {
        lookup: TLookup
        options?: Record<string, unknown>
    }
}

export interface IDuplicateEventMeta<TResult, TLookup, TInput> extends IMutationEventMeta<TResult> {
    args?: {
        lookup: TLookup
        overrides?: Partial<TInput>
        options?: Record<string, unknown>
    }
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
