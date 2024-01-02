import { describe, expect, it } from 'vitest'
import {
    PermissionError,
    PermissionRuleType,
    PermissionValidator,
} from './permission-validator'

describe('Permission Builder', () => {
    it('should create a builder instance statically or with a constructor', () => {
        const viaStatic = PermissionValidator.create()
        const viaConstructor = new PermissionValidator()

        expect(viaStatic).toBeInstanceOf(PermissionValidator)
        expect(viaConstructor).toBeInstanceOf(PermissionValidator)
    })

    it('should be able to add validation rules', () => {
        const validator = PermissionValidator.create().addRule({
            type: PermissionRuleType.ALL_OF,
            permissions: ['some', 'permissions'],
            errorMessage: 'Tisk tisk',
        })

        expect(validator).toBeInstanceOf(PermissionValidator)
        expect(validator.rules.length).toBe(1)
    })

    it('should be able to validate rules', () => {
        const validator = PermissionValidator.create().addRule({
            type: PermissionRuleType.ALL_OF,
            permissions: ['some', 'permissions'],
            errorMessage: 'Tisk tisk',
        })

        const validResult = validator.validate([
            'look',
            'we',
            'have',
            'some',
            'permissions',
            'and',
            'some',
            'more',
        ])

        expect(validResult).toBe(true)
        expect(() =>
            validator.validate(['we', 'are', 'not', 'authorized']),
        ).toThrowError('Tisk tisk')
    })

    it('should be able to safe validate rules, so they do not throw permission errors', () => {
        const validator = PermissionValidator.create().addRule({
            type: PermissionRuleType.ALL_OF,
            permissions: ['some', 'permissions'],
            errorMessage: 'Tisk tisk',
        })

        const validResult = validator.safeValidate([
            'look',
            'we',
            'have',
            'some',
            'permissions',
            'and',
            'some',
            'more',
        ])

        expect(validResult).to.deep.equal({
            valid: true,
            errorMessage: '',
            errors: [],
        })

        expect(() =>
            validator.safeValidate(['we', 'are', 'not', 'authorized']),
        ).not.toThrowError()
        const result = validator.safeValidate([
            'we',
            'are',
            'not',
            'authorized',
        ])
        expect(result).to.deep.equal({
            valid: false,
            errorMessage: 'Tisk tisk',
            errors: [
                new PermissionError('Tisk tisk', validator.rules[0], [
                    'we',
                    'are',
                    'not',
                    'authorized',
                ]),
            ],
        })
    })

    it('should support requiring all of a list of permissions', () => {
        const validator = PermissionValidator.create().allOf([
            'permissions',
            'you',
            'need',
        ])

        const validResult = validator.validate([
            'i',
            'have',
            'the',
            'permissions',
            'you',
            'need',
        ])

        expect(validResult).toBe(true)
    })

    it('should support requiring none of a list of permissions', () => {
        const validator = PermissionValidator.create().noneOf(
            ['bad', 'things'],
            'NOPE',
        )

        const validResult = validator.validate([
            'i',
            'have',
            'the',
            'permissions',
            'you',
            'need',
        ])

        expect(validResult).toBe(true)

        expect(() =>
            validator.validate(['i', 'have', 'bad', 'stuff']),
        ).toThrowError('NOPE')
    })

    it('should support requiring some of a list of permissions', () => {
        const validator = PermissionValidator.create().someOf(
            ['some', 'optional', 'permissions'],
            'You had one job',
        )

        const validResult = validator.validate([
            'i',
            'have',
            'the',
            'permissions',
            'you',
            'need',
        ])

        expect(validResult).toBe(true)

        expect(() =>
            validator.validate(['i', 'have', 'bad', 'stuff']),
        ).toThrowError('You had one job')
    })

    it('should be able to mix and match permissions', () => {
        const validator = PermissionValidator.create()
            .allOf(['luke', 'leia', 'han', 'chewie'], 'Where are my heroes?')
            .someOf(['obi-wan', 'yoda'], 'Requires 1 master jedi')
            .noneOf(
                ['darth-vader', 'storm-trooper', 'emperor'],
                'No sith allowed',
            )

        const validResult = validator.validate([
            'leia',
            'han',
            'yoda',
            'chewie',
            'c3po',
            'r2d2',
            'han',
            'luke',
        ])

        expect(validResult).toBe(true)

        expect(() =>
            validator.validate([
                'leia',
                'han',
                'yoda',
                'chewie',
                'c3po',
                'r2d2',
                'han',
                'luke',
                'storm-trooper',
            ]),
        ).toThrowError('No sith allowed')

        expect(() => {
            validator.validate([
                'leia',
                'han',
                'yoda',
                'chewie',
                'c3po',
                'r2d2',
                'han',
            ])
        }).toThrowError('Where are my heroes?')

        expect(() => {
            validator.validate([
                'leia',
                'han',
                'chewie',
                'c3po',
                'r2d2',
                'han',
                'luke',
            ])
        }).toThrowError('Requires 1 master jedi')
    })
})
