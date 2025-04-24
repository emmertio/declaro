import { EventManager, type IEvent } from './event-manager'
import { describe, it, expect, vi } from 'vitest'

class TestEvent implements IEvent {
    constructor(public readonly type: string) {}
}

describe('Event manager', () => {
    it('should add listeners', async () => {
        const eventManager = new EventManager()
        const testEvent = new TestEvent('test')

        const mockListener = vi.fn((event: TestEvent) => {
            expect(event).toBe(testEvent)
        })

        eventManager.on('test', mockListener)

        await eventManager.emitAll(testEvent)

        expect(mockListener.mock.calls.length).toBe(1)
    })

    it('should remove listeners', async () => {
        const eventManager = new EventManager()
        const testEvent = new TestEvent('test')

        const cb = (event: TestEvent) => {
            expect(event).toBe(testEvent)
        }

        const listener1 = vi.fn(cb)
        const listener2 = vi.fn(cb)
        const listener3 = vi.fn(cb)
        const listener4 = vi.fn(cb)
        const listener5 = vi.fn(cb)

        eventManager.on('test', listener1)
        eventManager.on('test', listener2)
        const removeListener = eventManager.on('test', listener3)
        eventManager.on('test', listener4)
        eventManager.on('test', listener5)

        removeListener()

        await eventManager.emitAll(testEvent)

        expect(listener1.mock.calls.length).toBe(1)
        expect(listener2.mock.calls.length).toBe(1)
        expect(listener3.mock.calls.length).toBe(0)
        expect(listener4.mock.calls.length).toBe(1)
        expect(listener5.mock.calls.length).toBe(1)
    })

    it('should support listening to multiple events', async () => {
        const eventManager = new EventManager()

        const cb = (event: TestEvent) => {
            expect(event).toBeInstanceOf(TestEvent)
        }

        const listener1 = vi.fn(cb)
        const listener2 = vi.fn(cb)

        eventManager.on(['event-1', 'event-2'], listener1)
        eventManager.on(['event-3', 'event-4', 'event-5'], listener2)

        await eventManager.emitAll(new TestEvent('event-1'))
        await eventManager.emitAll(new TestEvent('event-2'))
        await eventManager.emitAll(new TestEvent('event-3'))
        await eventManager.emitAll(new TestEvent('event-4'))
        await eventManager.emitAll(new TestEvent('event-5'))

        expect(listener1.mock.calls.length).toBe(2)
        expect(listener2.mock.calls.length).toBe(3)
        expect(eventManager.getEvents().length).toBe(5)
    })

    it('should be able to subscribe to all events', async () => {
        const eventManager = new EventManager()

        const cb = (event: TestEvent) => {
            expect(event).toBeInstanceOf(TestEvent)
        }

        const listener1 = vi.fn(cb)
        const listener2 = vi.fn(cb)

        eventManager.on(['*', 'event-1'], listener1) // This should only call the listener once
        eventManager.on('*', listener2)

        await eventManager.emitAll(new TestEvent('event-1'))
        await eventManager.emitAll(new TestEvent('event-2'))

        expect(listener1.mock.calls.length).toBe(2)
        expect(listener2.mock.calls.length).toBe(2)
    })

    it('should be able to forward events to another event manager', async () => {
        const cb1 = vi.fn()
        const cb2 = vi.fn()

        const eventManager1 = new EventManager()
        eventManager1.on('test', cb1)

        const eventManager2 = new EventManager()
        eventManager2.on('test', cb2)

        eventManager2.forwardTo(eventManager1)

        const testEvent = new TestEvent('test')
        await eventManager2.emitAll(testEvent)

        expect(cb1.mock.calls.length).toBe(1)
        expect(cb2.mock.calls.length).toBe(1)
        expect(cb1.mock.calls[0][0]).toBe(testEvent)
        expect(cb2.mock.calls[0][0]).toBe(testEvent)
        expect(eventManager1.getListeners('test').length).toBe(1)
        expect(eventManager2.getListeners('test').length).toBe(2)
    })

    it('should await forwarded listeners', async () => {
        const cb1 = vi.fn(async () => {
            await new Promise((resolve) => setTimeout(resolve, 10))
        })
        const cb2 = vi.fn(async () => {
            await new Promise((resolve) => setTimeout(resolve, 10))
        })

        const eventManager1 = new EventManager()
        eventManager1.on('test', cb1)

        const eventManager2 = new EventManager()
        eventManager2.on('test', cb2)

        eventManager2.forwardTo(eventManager1)

        const testEvent = new TestEvent('test')
        await eventManager2.emitAll(testEvent)

        expect(cb1.mock.calls.length).toBe(1)
        expect(cb2.mock.calls.length).toBe(1)

        // expect all callbacks to have finished
        expect(cb1).toHaveResolved()
        expect(cb2).toHaveResolved()

        await eventManager2.emitAsync(testEvent)

        expect(cb1.mock.calls.length).toBe(2)
        expect(cb2.mock.calls.length).toBe(2)

        // expect all callbacks to have finished
        expect(cb1).toHaveResolved()
        expect(cb2).toHaveResolved()
    })

    it('should extend another event manager', async () => {
        const eventManager1 = new EventManager()
        const eventManager2 = new EventManager()

        const cb1 = vi.fn()
        const cb2 = vi.fn()

        eventManager1.on('test', cb1)
        eventManager2.on('test', cb2)

        eventManager2.extend(eventManager1)

        const testEvent = new TestEvent('test')

        await eventManager2.emitAll(testEvent)
        expect(cb1.mock.calls.length).toBe(1)
        expect(cb2.mock.calls.length).toBe(1)
        expect(cb1.mock.calls[0][0]).toBe(testEvent)
        expect(cb2.mock.calls[0][0]).toBe(testEvent)
    })
})
