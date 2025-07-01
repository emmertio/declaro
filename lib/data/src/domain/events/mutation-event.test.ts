import { describe, it, expect } from 'bun:test'
import { MutationEvent } from './mutation-event'

describe('MutationEvent', () => {
    it('should create a mutation event with input and descriptor', () => {
        const input = { key: 'value' }
        const descriptor = { namespace: 'test', action: 'create' }
        const event = new MutationEvent(descriptor, input, {})

        expect(event.descriptor.namespace).toBe('test')
        expect(event.descriptor.action).toBe('create')
        expect(event.meta.input).toEqual(input)
    })

    it('should update meta correctly', () => {
        const input = { key: 'value' }
        const descriptor = { namespace: 'test', action: 'create' }
        const event = new MutationEvent(descriptor, input, {
            foo: 'bar',
        })

        event.setMeta({
            foo: 'baz',
        })

        expect(event.meta.foo).toBe('baz')
    })

    it('should set result correctly', () => {
        const input = { key: 'value' }
        const descriptor = { namespace: 'test', action: 'create' }
        const event = new MutationEvent(descriptor, input, {})

        const result = { success: true }
        event.setResult(result)
        expect(event.data).toEqual(result)
    })
})
