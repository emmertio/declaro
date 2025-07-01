import { describe, it, expect } from 'bun:test'
import { RequestEvent } from './request-event'

describe('RequestEvent', () => {
    it('should initialize meta correctly', () => {
        const input = { key: 'value' }
        const descriptor = { namespace: 'test', action: 'create' }
        const event = new RequestEvent(descriptor, input, {
            foo: 'bar',
        })

        expect(event.meta.foo).toBe('bar')
        expect(event.meta.input?.key).toBe('value')
    })

    it('should update meta correctly', () => {
        const input = { key: 'value' }
        const descriptor = { namespace: 'test', action: 'create' }
        const event = new RequestEvent(descriptor, input, {
            foo: 'bar',
        })

        event.setMeta({ foo: 'test' })
        expect(event.meta.foo).toBe('test')
    })

    it('should set result correctly', () => {
        const input = { key: 'value' }
        const descriptor = { namespace: 'test', action: 'create' }
        const event = new RequestEvent(descriptor, input, {
            foo: 'bar',
        })

        const result = { success: true }
        event.setResult(result)
        expect(event.data).toEqual(result)
    })
})
