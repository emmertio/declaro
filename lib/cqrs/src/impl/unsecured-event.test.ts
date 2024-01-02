import { describe, expect, it } from 'vitest'
import { getEventName, UnsecuredEvent } from './unsecured-event'
import { z } from 'zod'
import * as constants from 'constants'

describe('Unsecured Events', () => {
    it('Should validate true by default, where no validation is provided', () => {
        class NoValidationEvent extends UnsecuredEvent {
            readonly $name = 'test/no-validation'

            number: number

            serialize() {
                return {
                    number: this.number,
                }
            }
        }

        const noValidateEvent = new NoValidationEvent()
        noValidateEvent.number = 0

        // Validation should always return true by default
        expect(noValidateEvent.validate()).toBe(true)
    })

    it('should support adding custom validation, with zod supported out of the box', () => {
        class ValidationEvent extends UnsecuredEvent {
            readonly $name = 'test/validation'

            protected readonly $validation = z.object({
                number: z.number().min(10, 'Too Low').max(100, 'Too High'),
            })

            number: number

            serialize() {
                return {
                    number: this.number,
                }
            }
        }

        const validationEvent = new ValidationEvent()
        validationEvent.number = 0

        // Validation should throw errors that adhere to the IError spec, otherwise errors are up to the implementation.
        expect(() => validationEvent.validate()).toThrowError('Too Low')
        validationEvent.number = 101
        expect(() => validationEvent.validate()).toThrowError('Too High')
        validationEvent.number = 42
        expect(validationEvent.validate()).toBe(true)
    })

    it('should expose a util for getting the name of an event ref', () => {
        // Currently, event refs must be strings. It's possible we will allow passing instances or class definitions as well. Any time a ref needs to be coerced to a string, we need a standard util to be responsible for this logic.
        const eventNameForString = getEventName('test/event' as const)

        expect(eventNameForString).toBe('test/event')
    })
})
