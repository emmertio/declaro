import { type DeepPartial, type IEvent, type Maybe } from '@declaro/core'
import type { EntityEventType } from './entity-event-type'

export class EntityEvent<T extends object> implements IEvent {
    public readonly type: EntityEventType

    protected _entity?: Maybe<T>

    constructor(type: EntityEventType) {
        this.type = type
    }

    /**
     * Sets the entity associated with this event, replacing any previous value.
     *
     * @param entity
     * @returns chainable instance of the event
     */
    set(entity?: Maybe<T>): this {
        this._entity = entity
        return this
    }

    /**
     * Gets the entity associated with this event.
     */
    get entity(): Maybe<T> {
        return this._entity
    }

    /**
     * An alias for `set(entity)`.
     */
    set entity(entity: Maybe<T>) {
        this.set(entity)
    }

    /**
     * Updates the entity with the provided partial data.
     *
     * @param data
     * @returns
     */
    patch(data: DeepPartial<T>): this {
        if (!this._entity) {
            throw new Error('Cannot update empty entity')
        }

        if (data) {
            Object.assign(this._entity, data)
        }

        return this
    }
}
