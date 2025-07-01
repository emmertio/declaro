import { describe, expect, it } from 'bun:test'
import { ActionDescriptor } from './action-descriptor'

describe('ActionDescriptor', () => {
    describe('constructor', () => {
        it('should initialize with input values', () => {
            const input = { namespace: 'auth', resource: 'user', action: 'create', scope: 'admin' }
            const descriptor = new ActionDescriptor(input)

            expect(descriptor.namespace).toBe('auth')
            expect(descriptor.resource).toBe('user')
            expect(descriptor.action).toBe('create')
            expect(descriptor.scope).toBe('admin')
        })

        it('should initialize with default values if input is missing', () => {
            const input = {}
            const descriptor = new ActionDescriptor(input)

            expect(descriptor.namespace).toBe('global')
            expect(descriptor.resource).toBe('*')
            expect(descriptor.action).toBe('*')
            expect(descriptor.scope).toBeUndefined()
        })
    })

    describe('update', () => {
        it('should update descriptor values', () => {
            const input = { namespace: 'auth', resource: 'user', action: 'create', scope: 'admin' }
            const descriptor = new ActionDescriptor(input)

            descriptor.update({ resource: 'group', action: 'delete' })

            expect(descriptor.namespace).toBe('auth')
            expect(descriptor.resource).toBe('group')
            expect(descriptor.action).toBe('delete')
            expect(descriptor.scope).toBe('admin')
        })

        it('should retain existing values if update input is missing', () => {
            const input = { namespace: 'auth', resource: 'user', action: 'create', scope: 'admin' }
            const descriptor = new ActionDescriptor(input)

            descriptor.update({})

            expect(descriptor.namespace).toBe('auth')
            expect(descriptor.resource).toBe('user')
            expect(descriptor.action).toBe('create')
            expect(descriptor.scope).toBe('admin')
        })
    })

    describe('toJSON', () => {
        it('should return a JSON representation of the descriptor', () => {
            const input = { namespace: 'auth', resource: 'user', action: 'create', scope: 'admin' }
            const descriptor = new ActionDescriptor(input)

            const json = descriptor.toJSON()
            expect(json).toEqual(input)
        })
    })

    describe('toString', () => {
        it('should return a string representation of the descriptor', () => {
            const input = { namespace: 'auth', resource: 'user', action: 'create', scope: 'admin' }
            const descriptor = new ActionDescriptor(input)

            const str = descriptor.toString()
            expect(str).toBe('auth::user.create:admin')
        })

        it('should handle missing scope gracefully', () => {
            const input = { namespace: 'auth', resource: 'user', action: 'create' }
            const descriptor = new ActionDescriptor(input)

            const str = descriptor.toString()
            expect(str).toBe('auth::user.create')
        })
    })

    describe('parse', () => {
        it('should parse a string into an ActionDescriptor', () => {
            const descriptor = new ActionDescriptor({ namespace: 'global' })

            const input = 'auth::user.create:admin'
            descriptor.parse(input)

            expect(descriptor.namespace).toBe('auth')
            expect(descriptor.resource).toBe('user')
            expect(descriptor.action).toBe('create')
            expect(descriptor.scope).toBe('admin')
        })

        it('should handle missing scope gracefully', () => {
            const descriptor = new ActionDescriptor({ namespace: 'global' })

            const input = 'auth::user.create'
            descriptor.parse(input)

            expect(descriptor.namespace).toBe('auth')
            expect(descriptor.resource).toBe('user')
            expect(descriptor.action).toBe('create')
            expect(descriptor.scope).toBeUndefined()
        })

        it('should use default values for missing parts', () => {
            const descriptor = new ActionDescriptor({ namespace: 'global' })

            const input = 'auth'
            descriptor.parse(input)

            expect(descriptor.namespace).toBe('auth')
            expect(descriptor.resource).toBe('*')
            expect(descriptor.action).toBe('*')
            expect(descriptor.scope).toBeUndefined()
        })
    })

    describe('fromJSON', () => {
        it('should create an ActionDescriptor from a JSON object', () => {
            const input = { namespace: 'auth', resource: 'user', action: 'create', scope: 'admin' }
            const descriptor = ActionDescriptor.fromJSON(input)

            expect(descriptor.namespace).toBe('auth')
            expect(descriptor.resource).toBe('user')
            expect(descriptor.action).toBe('create')
            expect(descriptor.scope).toBe('admin')
        })

        it('should handle missing scope gracefully', () => {
            const input = { namespace: 'auth', resource: 'user', action: 'create' }
            const descriptor = ActionDescriptor.fromJSON(input)

            expect(descriptor.namespace).toBe('auth')
            expect(descriptor.resource).toBe('user')
            expect(descriptor.action).toBe('create')
            expect(descriptor.scope).toBeUndefined()
        })

        it('should use default values for missing parts', () => {
            const input = { namespace: 'auth', resource: '*', action: '*', scope: undefined }
            const descriptor = ActionDescriptor.fromJSON(input)

            expect(descriptor.namespace).toBe('auth')
            expect(descriptor.resource).toBe('*')
            expect(descriptor.action).toBe('*')
            expect(descriptor.scope).toBeUndefined()
        })
    })

    describe('fromString', () => {
        it('should create an ActionDescriptor from a string', () => {
            const input = 'auth::user.create:admin'
            const descriptor = ActionDescriptor.fromString(input)

            expect(descriptor.namespace).toBe('auth')
            expect(descriptor.resource).toBe('user')
            expect(descriptor.action).toBe('create')
            expect(descriptor.scope).toBe('admin')
        })

        it('should handle missing scope gracefully', () => {
            const input = 'auth::user.create'
            const descriptor = ActionDescriptor.fromString(input)

            expect(descriptor.namespace).toBe('auth')
            expect(descriptor.resource).toBe('user')
            expect(descriptor.action).toBe('create')
            expect(descriptor.scope).toBeUndefined()
        })

        it('should use default values for missing parts', () => {
            const input = 'auth'
            const descriptor = ActionDescriptor.fromString(input)

            expect(descriptor.namespace).toBe('auth')
            expect(descriptor.resource).toBe('*')
            expect(descriptor.action).toBe('*')
            expect(descriptor.scope).toBeUndefined()
        })
    })
})
