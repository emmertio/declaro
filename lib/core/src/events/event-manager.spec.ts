import { EventManager } from './event-manager'
import { describe, it, expect, vi } from 'vitest'

class TestEvent {}

describe('Event manager', () => {
    it('should add listeners', async () => {
        const eventManager = new EventManager<TestEvent>()
        const testEvent = new TestEvent()

        const mockListener = vi.fn((event: TestEvent) => {
            expect(event).toBe(testEvent)
        })

        eventManager.on('test', mockListener)

        await eventManager.emitAll('test', testEvent)

        expect(mockListener.mock.calls.length).toBe(1)
    })

    it('should remove listeners', async () => {
        const eventManager = new EventManager<TestEvent>()
        const testEvent = new TestEvent()

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

        await eventManager.emitAll('test', testEvent)

        expect(listener1.mock.calls.length).toBe(1)
        expect(listener2.mock.calls.length).toBe(1)
        expect(listener3.mock.calls.length).toBe(0)
        expect(listener4.mock.calls.length).toBe(1)
        expect(listener5.mock.calls.length).toBe(1)
    })
})
