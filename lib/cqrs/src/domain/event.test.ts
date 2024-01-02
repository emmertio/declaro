import { describe, expect, it } from 'vitest'
import type { IEvent } from './event'

describe('Class based event definition', () => {
    class TestEvent implements IEvent {
        readonly $name = 'test/event'

        message: string

        serialize() {
            return {
                message: this.message,
            }
        }

        validate(): boolean {
            return true
        }
    }

    it('Should be identified in a standard manner', () => {
        const eventInstance = new TestEvent()

        expect(eventInstance.$name).toBe('test/event')
    })

    it('Should serialize itself according to a simple interface', () => {
        const event = new TestEvent()
        event.message = 'Hello World'

        const payload = event.serialize()

        expect(payload).to.deep.equal({
            message: 'Hello World',
        })
    })

    it('should be able to perscriptively type event names using a generic', () => {
        let specificEvent: IEvent<'test/event'>
        specificEvent = new TestEvent()

        let wrongEvent: IEvent<'test/asdf'>
        //@ts-ignore
        wrongEvent = new TestEvent()

        // This test is a little redundant. It exists mostly to demonstrate correct typing and usage thereof.
        expect(specificEvent.$name).toBe('test/event')
        expect(wrongEvent.$name).to.not.equal('test/asdf')
    })
})
