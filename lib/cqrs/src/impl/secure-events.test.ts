import { describe, expect, it } from 'vitest'
import { UnsecuredEvent } from './unsecured-event'
import { SecureEvent } from './secure-event'
import {
    PermissionError,
    PermissionRuleType,
    PermissionValidator,
} from './auth/permission-validator'

describe('Secure Events', () => {
    class MySecureEvent extends SecureEvent {
        readonly $name = 'test/secure'
        protected readonly $permissions = PermissionValidator.create().allOf(
            ['tweet-at-4am', 'break-the-internet'],
            'You made the SEC angry',
        )

        serialize() {
            return {
                elonSays: 'Funding Secured',
            }
        }
    }

    it('should be an instance of the base Event class', () => {
        const event = new MySecureEvent()

        expect(event).toBeInstanceOf(UnsecuredEvent)
    })

    it('should validate permissions when all required permissions are present', () => {
        const event = new MySecureEvent()

        // Should validate when all the permissions are present
        expect(
            event.validatePermissions([
                'obsessed-with-letter-x',
                'tweet-at-4am',
                'blow-rockets-up',
                'break-the-internet',
                'has-sink',
            ]),
        ).toBe(true)
    })

    it('should fail permission validation when at least 1 permission is absent', () => {
        const event = new MySecureEvent()
        expect(() =>
            event.validatePermissions([
                'obsessed-with-letter-x',
                'blow-rockets-up',
                'break-the-internet',
                'has-sink',
            ]),
        ).toThrowError()
    })

    it('should fail permission validation when all permissions are absent', () => {
        const event = new MySecureEvent()
        expect(() =>
            event.validatePermissions([
                'obsessed-with-letter-x',
                'blow-rockets-up',
                'has-sink',
            ]),
        )
    })

    it('should safe validate permissions', () => {
        const event = new MySecureEvent()

        const validResults = event.safeValidatePermissions([
            'obsessed-with-letter-x',
            'tweet-at-4am',
            'blow-rockets-up',
            'break-the-internet',
            'has-sink',
        ])

        expect(validResults.valid).toBe(true)
        expect(validResults.errors).to.deep.equal([])
        expect(validResults.errorMessage).toBe('')

        const invalidResults = event.safeValidatePermissions([
            'obsessed-with-letter-x',
            'blow-rockets-up',
            'break-the-internet',
            'has-sink',
        ])

        expect(invalidResults.valid).toBe(false)
        expect(invalidResults.errors).to.deep.equal([
            new PermissionError(
                'You made the SEC angry',
                {
                    type: PermissionRuleType.ALL_OF,
                    permissions: ['tweet-at-4am', 'break-the-internet'],
                    errorMessage: 'You made the SEC angry',
                },
                [
                    'obsessed-with-letter-x',
                    'blow-rockets-up',
                    'break-the-internet',
                    'has-sink',
                ],
            ),
        ])
    })
})
