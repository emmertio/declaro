import { EventManager, type IEvent } from '@declaro/core'
import type Redis from 'ioredis'
import MockRedis from 'ioredis-mock'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { RedisEventAdapter } from './redis-event-adapter'

interface TestEvent extends IEvent {
    message: string
    nestedObject: {
        foo: number
        bar: string
    }
}

describe('RedisEventAdapter', () => {
    let pub: Redis
    let sub1: Redis
    let sub2: Redis

    beforeAll(() => {
        sub1 = new MockRedis()
        sub2 = new MockRedis()
        pub = new MockRedis()
    })

    it('should patch event manager events through redis', async () => {
        const eventManagerA = new EventManager()
        const redisEventAdapter = new RedisEventAdapter(eventManagerA, pub, sub1)

        const eventManagerB = new EventManager()
        const redisEventAdapterB = new RedisEventAdapter(eventManagerB, pub, sub2)

        const eventA: TestEvent = {
            type: 'testA',
            message: 'Hello World',
            nestedObject: {
                foo: 42,
                bar: '1337',
            },
        }

        await new Promise(async (resolve, reject) => {
            const cbB = vi.fn((event: TestEvent) => {
                expect(event.type).toBe('testA')
                expect(event.message).toBe('Hello World')
                expect(event.nestedObject.foo).toBe(42)
                expect(event.nestedObject.bar).toBe('1337')
                resolve(undefined)
            })

            eventManagerB.on('testA', cbB)

            eventManagerA.emitAsync(eventA)
        })

        redisEventAdapter.unsubscribe()
        redisEventAdapterB.unsubscribe()
    })

    afterAll(() => {
        pub.disconnect()
        sub1.disconnect()
        sub2.disconnect()
    })
})
