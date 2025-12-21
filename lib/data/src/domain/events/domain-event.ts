import type { IAuthSession } from '@declaro/auth'
import { type IEvent, type IActionDescriptor, ActionDescriptor, type IActionDescriptorInput } from '@declaro/core'
import { v4 as uuid } from 'uuid'

export interface IDomainEvent<T, M = any> extends IEvent {
    eventId: string
    data?: T
    meta?: M
    timestamp: Date
    descriptor: IActionDescriptor
    session?: IAuthSession
}

export interface IDomainEventOptions<TData, TMeta = any> {
    type?: string
    eventId?: string
    data?: TData
    timestamp?: Date
    descriptor?: IActionDescriptorInput
    session?: IAuthSession
    meta?: TMeta
}

export interface IDomainEventJSON<T, M = any> {
    eventId: string
    data?: T
    meta: M
    timestamp: string // JSON-compatible format
    type: string
    session?: { id: string } // Simplified session representation
}

export class DomainEvent<T, M = any> implements IDomainEvent<T, M> {
    readonly eventId: string
    public data?: T
    public timestamp: Date
    public type: string = 'UNKNOWN_EVENT'
    public descriptor: ActionDescriptor
    public session?: IAuthSession
    public meta: M

    constructor(options: IDomainEventOptions<T, M> = {}) {
        if (options.type) {
            this.type = options.type
        }
        this.eventId = options.eventId ?? uuid()
        this.timestamp = options.timestamp ?? new Date()
        this.descriptor = options.descriptor
            ? ActionDescriptor.fromJSON(options.descriptor)
            : ActionDescriptor.fromString(this.type)
        if (options.descriptor && this.type === 'UNKNOWN_EVENT') {
            this.type = this.descriptor.toString()
        }
        this.data = options.data
        this.meta = options.meta ?? ({} as M) // Ensure meta is always defined, defaulting to an empty object
        this.session = options.session
    }

    toJSON(): IDomainEventJSON<T, M> {
        return {
            eventId: this.eventId,
            data: this.data,
            meta: this.meta,
            timestamp: this.timestamp.toISOString(),
            type: this.type,
            session: this.session ? { id: this.session.id } : undefined,
        }
    }
}
