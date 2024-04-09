import type { EventRef, IEvent } from './event'
import type {
    EventKey,
    EventProcessorMap,
    IEventProcessor,
    SelectProcessorEvent,
} from './event-processor'
import type { PromiseOrValue } from '@declaro/core'

export type BeforeEventCallback<E extends IEvent> = (
    event: E,
) => PromiseOrValue<boolean | void>
export type AfterEventCallback<
    E extends IEvent,
    T extends EventProcessorMap,
> = (event: E, result: DispatchResult<E, T>) => PromiseOrValue<boolean | void>

export type DispatchResult<
    E extends IEvent,
    P extends EventProcessorMap,
> = ReturnType<P[E['$name']]['process']>

export type BusMap<B extends IBus<any>> = ReturnType<B['getProcessors']>
export interface IBus<T extends EventProcessorMap> {
    dispatch<E extends IEvent>(event: E): Promise<DispatchResult<E, T>>
    addEventProcessor<Proc extends IEventProcessor>(
        processor: Proc,
    ): IBus<
        T & {
            [key in Proc['event']]: Proc
        }
    >

    before<E extends EventKey<T>>(
        event: EventRef<E>,
        callback: BeforeEventCallback<SelectProcessorEvent<T, E>>,
    ): IBus<T>
    after<E extends EventKey<T>>(
        event: EventRef<E>,
        callback: AfterEventCallback<SelectProcessorEvent<T, E>, T>,
    ): IBus<T>

    getProcessors(): T
}
