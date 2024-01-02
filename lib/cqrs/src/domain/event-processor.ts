import type { IEvent } from './event'

export interface IEventProcessor<E extends IEvent = IEvent> {
    readonly event: string
    process(event: E): Promise<any>
}

export type EventProcessorMap = Record<string, IEventProcessor>

export type UnwrapProcessorEvent<T extends IEventProcessor> = Parameters<
    T['process']
>[0]
export type SelectProcessorEvent<
    T extends EventProcessorMap,
    K extends EventKey<T>,
> = UnwrapProcessorEvent<T[K]>

export type EventKey<T extends EventProcessorMap> = {
    [K in keyof T]: K extends string ? K : never
}[keyof T]
