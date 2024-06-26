import { ZodType } from 'zod'
import { type IError } from '@declaro/core/src/typescript/errors'
import type {
    EventRef,
    EventRefName,
    IEvent,
    IEventValidationResult,
    ISerializable,
    IValidatable,
} from '../domain/event'

export abstract class UnsecuredEvent
    implements IEvent, ISerializable, IValidatable
{
    abstract readonly $name: string

    protected readonly $validation: ZodType
    serialize(): any {
        const keys = Object.keys(this).filter((key) => !key.startsWith('$'))

        return keys.reduce((out, key) => {
            return {
                [key]: this[key],
                ...out,
            }
        }, {})
    }
    parse(payload: any): any {
        let values: any
        if (this.$validation) {
            values = this.$validation.parse(payload)
        } else {
            values = payload
        }
        Object.assign(this, values)
    }

    validate(): boolean {
        if (this.$validation) {
            const payload = this.serialize()
            return !!this.$validation.parse(payload)
        } else {
            return true
        }
    }

    safeValidate(): IEventValidationResult {
        const validation = {
            success: false,
            errors: <IError[]>[],
            errorMessage: '',
        }
        try {
            validation.success = this.validate()
        } catch (e) {
            validation.errors = [e]
            validation.errorMessage = e.message
        }

        return validation
    }
}

export abstract class UnsecuredCommand extends UnsecuredEvent {}

export abstract class UnsecuredQuery extends UnsecuredEvent {}

export function getEventName<E extends EventRef<any>>(
    event: E,
): EventRefName<E> {
    if (typeof event === 'string') {
        return event as EventRefName<E>
    } else {
        console.error('Invalid event:', event)
        throw new Error('Cannot get event name for a non-event')
    }
}
