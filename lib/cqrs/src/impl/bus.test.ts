import { describe, expect, it, vitest } from 'vitest'
import { Bus } from './bus'
import type { IEventProcessor } from '../domain/event-processor'
import { UnsecuredCommand, UnsecuredQuery } from './unsecured-event'
import type {
    AfterEventCallback,
    BeforeEventCallback,
    DispatchResult,
} from '../domain/bus'

class CustomCommand extends UnsecuredCommand {
    readonly $name = 'CustomCommand'

    constructor(protected readonly messageName: string) {
        super()
    }

    serialize() {
        return {
            message: this.messageName,
        }
    }
}

class CustomCommandProcessor implements IEventProcessor {
    readonly event = 'CustomCommand'

    async process(event: CustomCommand) {
        return {
            message: `Hello ${event.serialize().message}`,
        }
    }
}

class CustomQuery extends UnsecuredQuery {
    readonly $name = 'CustomQuery'

    constructor(protected readonly messageName: string) {
        super()
    }

    serialize() {
        return {
            message: this.messageName,
            number: 42,
        }
    }
}

class CustomQueryProcessor implements IEventProcessor {
    readonly event = 'CustomQuery'

    async process(event: CustomQuery) {
        return {
            message: `Queried ${event.serialize().message}`,
            number: event.serialize().number * 2,
        }
    }
}

describe('Bus', () => {
    it('should be able to subscribe to events before they dispatch', async () => {
        const markProcess = vitest.fn()
        const beforeHandler = vitest.fn(((event) => {
            expect(event).toBeInstanceOf(CustomQuery)
            expect(markProcess.mock.calls.length).toBe(0)
        }) as BeforeEventCallback<CustomQuery>)
        class TrackedProcessor implements IEventProcessor {
            readonly event = 'CustomQuery'

            async process(event: CustomQuery) {
                markProcess()
                return {
                    message: `Queried ${event.serialize().message}`,
                    number: event.serialize().number * 2,
                }
            }
        }

        const dispatcher = new Bus()
            .addEventProcessor(new TrackedProcessor())
            .before('CustomQuery', beforeHandler)

        expect(beforeHandler.mock.calls.length).toBe(0)

        await dispatcher.dispatch(new CustomQuery('Hello World'))

        expect(beforeHandler.mock.calls.length).toBe(1)
    })

    it('should be able to subscribe to events after they dispatch', async () => {
        const markProcess = vitest.fn()
        const afterHandler = vitest.fn(((event, result) => {
            expect(event).toBeInstanceOf(CustomQuery)
            expect(result).to.deep.equal({
                message: 'Queried Hello World',
            })
            expect(markProcess.mock.calls.length).toBe(1)
        }) as AfterEventCallback<CustomQuery, DispatchResult<any, any>>)
        class TrackedProcessor implements IEventProcessor {
            readonly event = 'CustomQuery'

            async process(event: CustomQuery) {
                markProcess()
                return {
                    message: `Queried ${event.serialize().message}`,
                }
            }
        }

        const bus = new Bus()
            .addEventProcessor(new TrackedProcessor())
            .after('CustomQuery', afterHandler)

        expect(afterHandler.mock.calls.length).toBe(0)

        await bus.dispatch(new CustomQuery('Hello World'))

        expect(afterHandler.mock.calls.length).toBe(1)
    })
})
