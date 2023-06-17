import { validate, validateAny } from './validator'
import { describe, it, vi } from 'vitest'

async function sleep(duration: number) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve(undefined)
        }, duration)
    })
}

describe('Validator', () => {
    it('Should validate with valid property', async ({ expect }) => {
        const value = {
            message: 'Hello World',
        }
        const valid = await validate(
            value,
            (val) => val.message === 'Hello World',
        ).valid

        expect(valid).toBeTruthy()
    })

    it('Should validate with invalid property', async ({ expect }) => {
        const value = {
            message: 'Hello Mr. Anderson',
        }
        const valid = await validate(
            value,
            (val) => val.message === 'Hello World',
        ).valid

        expect(valid).toBeFalsy()
    })

    it('Should validate with onValid callback', async ({ expect }) => {
        const valid = vi.fn((val) => {
            expect(val).toBe(42)
        })
        const invalid = vi.fn()

        const value = 42

        await validate(42, (val) => val > 10).onValid((value) => {
            valid(value)
        })

        await validate(42, (val) => val > 10).onInvalid((value) => {
            invalid(value)
        })

        expect(valid.mock.calls.length).toBe(1)
        expect(invalid.mock.calls.length).toBe(0)
    })

    it('Should validate with onInvalid callback', async ({ expect }) => {
        const valid = vi.fn((val) => {
            expect(val).toBe(42)
        })
        const invalid = vi.fn()

        const value = 42
        await validate(42, (val) => val > 50).onInvalid((val) => {
            invalid(value)
        })

        await validate(42, (val) => val > 50).onValid((val) => {
            valid(value)
        })

        expect(valid.mock.calls.length).toBe(0)
        expect(invalid.mock.calls.length).toBe(1)
    })

    it('Should validate multiple validators', async ({ expect }) => {
        const value = {
            message: 'Hello Mr. Anderson',
        }
        const valid = await validate(
            value,
            (val) => val.message.length > 5,
            (val) => !!val.message.match('Hello'),
            (val) => !!val.message.match('Mr.'),
        ).valid

        expect(valid).toBeTruthy()
    })

    it('Should invalidate if one of multiple validators fails', async ({
        expect,
    }) => {
        const value = {
            message: 'Hello Mr. Anderson',
        }
        const valid = await validate(
            value,
            (val) => val.message.length > 5,
            (val) => !!val.message.match('Morpheus'),
            (val) => !!val.message.match('Mr.'),
        ).valid

        expect(valid).toBeFalsy()
    })

    it('Should be able to validate an any strategy', async ({ expect }) => {
        const value = {
            message: 'Hello Mr. Anderson',
        }
        const valid = await validateAny(
            value,
            (val: any) => val.message.length > 256,
            (val: any) => !!val.message.match('Yo'),
            (val: any) => !!val.message.match('Mr.'),
        ).valid

        expect(valid).toBeTruthy()
    })

    it('Should be able to invalidate an any strategy', async ({ expect }) => {
        const value = {
            message: 'Hello Mr. Anderson',
        }
        const valid = await validateAny(
            value,
            (val: any) => val.message.length > 256,
            (val: any) => !!val.message.match('Yo'),
            (val: any) => !!val.message.match('Trinity'),
        ).valid

        expect(valid).toBeFalsy()
    })

    it('Should validate an async validator', async ({ expect }) => {
        const value = {
            message: 'Hello World',
        }
        const valid = await validate(value, async (val) => {
            await sleep(100)
            return val.message === 'Hello World'
        }).valid

        expect(valid).toBeTruthy()
    })
})
