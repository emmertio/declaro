import { describe, expect, it } from 'vitest'
import { PermissionError, PermissionRuleType, PermissionValidator } from './permission-validator'

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

        const validResult = validator.validate(['look', 'we', 'have', 'some', 'permissions', 'and', 'some', 'more'])

        expect(validResult).toBe(true)
        expect(() => validator.validate(['we', 'are', 'not', 'authorized'])).toThrowError('Tisk tisk')
    })

    it('should be able to safe validate rules, so they do not throw permission errors', () => {
        const validator = PermissionValidator.create().addRule({
            type: PermissionRuleType.ALL_OF,
            permissions: ['some', 'permissions'],
            errorMessage: 'Tisk tisk',
        })

        const validResult = validator.safeValidate(['look', 'we', 'have', 'some', 'permissions', 'and', 'some', 'more'])

        expect(validResult).to.deep.equal({
            valid: true,
            errorMessage: '',
            errors: [],
        })

        expect(() => validator.safeValidate(['we', 'are', 'not', 'authorized'])).not.toThrowError()
        const result = validator.safeValidate(['we', 'are', 'not', 'authorized'])
        expect(result).to.deep.equal({
            valid: false,
            errorMessage: 'Tisk tisk',
            errors: [new PermissionError('Tisk tisk', validator.rules[0], ['we', 'are', 'not', 'authorized'])],
        })
    })

    it('should support requiring all of a list of permissions', () => {
        const validator = PermissionValidator.create().allOf(['permissions', 'you', 'need'])

        const validResult = validator.validate(['i', 'have', 'the', 'permissions', 'you', 'need'])

        expect(validResult).toBe(true)
    })

    it('should support requiring none of a list of permissions', () => {
        const validator = PermissionValidator.create().noneOf(['bad', 'things'], 'NOPE')

        const validResult = validator.validate(['i', 'have', 'the', 'permissions', 'you', 'need'])

        expect(validResult).toBe(true)

        expect(() => validator.validate(['i', 'have', 'bad', 'stuff'])).toThrowError('NOPE')
    })

    it('should support requiring some of a list of permissions', () => {
        const validator = PermissionValidator.create().someOf(['some', 'optional', 'permissions'], 'You had one job')

        const validResult = validator.validate(['i', 'have', 'the', 'permissions', 'you', 'need'])

        expect(validResult).toBe(true)

        expect(() => validator.validate(['i', 'have', 'bad', 'stuff'])).toThrowError('You had one job')
    })

    it('should be able to mix and match permissions', () => {
        const validator = PermissionValidator.create()
            .allOf(['luke', 'leia', 'han', 'chewie'], 'Where are my heroes?')
            .someOf(['obi-wan', 'yoda'], 'Requires 1 master jedi')
            .noneOf(['darth-vader', 'storm-trooper', 'emperor'], 'No sith allowed')

        const validResult = validator.validate(['leia', 'han', 'yoda', 'chewie', 'c3po', 'r2d2', 'han', 'luke'])

        expect(validResult).toBe(true)

        expect(() =>
            validator.validate(['leia', 'han', 'yoda', 'chewie', 'c3po', 'r2d2', 'han', 'luke', 'storm-trooper']),
        ).toThrowError('No sith allowed')

        expect(() => {
            validator.validate(['leia', 'han', 'yoda', 'chewie', 'c3po', 'r2d2', 'han'])
        }).toThrowError('Where are my heroes?')

        expect(() => {
            validator.validate(['leia', 'han', 'chewie', 'c3po', 'r2d2', 'han', 'luke'])
        }).toThrowError('Requires 1 master jedi')
    })

    it('should validate multiple permission validators at once', () => {
        const validator = PermissionValidator.create()
            .allOf(['luke', 'leia', 'han', 'chewie'], 'Where are my heroes?')
            .someOf(['obi-wan', 'yoda'], 'Requires 1 master jedi')

        const validator2 = PermissionValidator.create().noneOf(
            ['darth-vader', 'storm-trooper', 'emperor'],
            'No sith allowed',
        )

        const combinedValidator = PermissionValidator.create().extend(validator, validator2)

        const validResult = combinedValidator.validate(['leia', 'han', 'yoda', 'chewie', 'c3po', 'r2d2', 'han', 'luke'])

        expect(validResult).toBe(true)

        expect(() =>
            combinedValidator.validate([
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
            combinedValidator.validate(['leia', 'han', 'yoda', 'chewie', 'c3po', 'r2d2', 'han'])
        }).toThrowError('Where are my heroes?')

        expect(() => {
            combinedValidator.validate(['leia', 'han', 'chewie', 'c3po', 'r2d2', 'han', 'luke'])
        }).toThrowError('Requires 1 master jedi')
    })

    it('Should be able to use validators interchangably with rules', () => {
        const heros = PermissionValidator.create().allOf(['luke', 'leia', 'han', 'chewie'])

        const jedi = PermissionValidator.create().someOf(['obi-wan', 'yoda'])

        const sith = PermissionValidator.create().someOf(['darth-vadar', 'emperor', 'darth-maul'])

        const lightSide = PermissionValidator.create().someOf([heros, jedi], 'The light side must be heroes or jedi')
        const darkSide = PermissionValidator.create().someOf(['palpatine', sith], 'Only dark side allowed')
        const lightOnly = PermissionValidator.create()
            .someOf([lightSide], 'Light side only')
            .noneOf([darkSide], 'No dark side allowed')

        expect(lightOnly.validate(['luke', 'leia', 'yoda'])).toBe(true)
        expect(() => lightOnly.validate(['luke', 'leia', 'yoda', 'darth-vadar'])).toThrowError('No dark side allowed')
        expect(() => lightOnly.validate(['luke', 'leia', 'yoda', 'darth-vadar', 'darth-maul'])).toThrowError(
            'No dark side allowed',
        )

        const dumbCharacters = PermissionValidator.create().someOf(['jar-jar-binx'], 'Oh George, what have you done?')

        const coolCharacters = PermissionValidator.create()
            .someOf([lightSide, darkSide], 'Must contain Star Wars characters')
            .noneOf([dumbCharacters], 'Oh George, what have you done?')

        expect(coolCharacters.validate(['luke', 'leia', 'han', 'chewie', 'yoda'])).toBe(true)
        expect(coolCharacters.validate(['luke', 'leia', 'han', 'chewie', 'yoda', 'darth-vadar'])).toBe(true)
        expect(coolCharacters.validate(['darth-vadar', 'darth-maul'])).toBe(true)
        expect(() => coolCharacters.validate(['luke', 'leia', 'han', 'chewie', 'yoda', 'jar-jar-binx'])).toThrowError(
            'Oh George, what have you done?',
        )
    })
})
