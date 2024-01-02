import type {
    EventKey,
    EventProcessorMap,
    IEventProcessor,
    SelectProcessorEvent,
} from '../domain/event-processor'
import type { EventRef, IEvent } from '../domain/event'
import type {
    AfterEventCallback,
    BeforeEventCallback,
    DispatchResult,
    IBus,
} from '../domain/bus'
import { getEventName } from './unsecured-event'

export class Bus<T extends EventProcessorMap = {}> implements IBus<T> {
    protected readonly beforeHandlerMap = new Map<
        string,
        BeforeEventCallback<any>[]
    >()
    protected readonly afterHandlerMap = new Map<
        string,
        AfterEventCallback<any, any>[]
    >()
    constructor(protected readonly processorMap: T = {} as T) {}

    addEventProcessor<Proc extends IEventProcessor>(
        processor: Proc,
    ): Bus<
        T & {
            [key in Proc['event']]: Proc
        }
    > {
        if (this.processorMap[processor.event]) {
            throw new Error(
                `You may only register one event processor per event and there is already an event processor registered for event ${processor.event}.`,
            )
        }
        return new Bus({
            ...this.processorMap,
            [processor.event]: processor,
        })
    }

    async dispatch<E extends IEvent>(event: E): Promise<DispatchResult<E, T>> {
        const processor = this.processorMap[event.$name]
        const key = event.$name

        const beforeHandlers = this.beforeHandlerMap.get(key) ?? []
        const afterHandlers = this.afterHandlerMap.get(key) ?? []

        // Execute before handlers in the order they were added.
        if (beforeHandlers.length > 0) {
            for (const handler of beforeHandlers) {
                await handler(event)
            }
        }

        if (!processor) {
            throw new Error(`No processor for event ${event.$name}`)
        }

        const result = await processor.process(event)

        if (afterHandlers.length > 0) {
            for (const handler of afterHandlers) {
                await handler(event, result)
            }
        }

        return result
    }

    before<E extends EventKey<T>>(
        event: EventRef<E>,
        callback: BeforeEventCallback<SelectProcessorEvent<T, E>>,
    ) {
        const key = getEventName(event)
        const handlers = this.beforeHandlerMap.get(key) ?? []
        handlers.push(callback)
        this.beforeHandlerMap.set(key, handlers)

        return this
    }

    after<E extends EventKey<T>>(
        event: EventRef<E>,
        callback: AfterEventCallback<SelectProcessorEvent<T, E>, T>,
    ) {
        const key = getEventName(event)
        const handlers = this.afterHandlerMap.get(key) ?? []
        handlers.push(callback)
        this.afterHandlerMap.set(key, handlers)

        return this
    }
}
