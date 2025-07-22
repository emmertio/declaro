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

        expect(validResult).toEqual({
            valid: true,
            errorMessage: '',
            errors: [],
        })

        expect(() => validator.safeValidate(['we', 'are', 'not', 'authorized'])).not.toThrowError()
        const result = validator.safeValidate(['we', 'are', 'not', 'authorized'])
        expect(result).toEqual({
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

    it('should not error when passed undefined instead of a permission array to validate', () => {
        const validator = PermissionValidator.create().someOf(['luke', 'leia', 'han', 'chewie'], 'Where are my heroes?')
        expect(() => validator.safeValidate(undefined)).not.toThrowError()
    })

    it('should support wildcards', () => {
        const validator = PermissionValidator.create().allOf(['*'])

        expect(validator.safeValidate(['anything']).valid).toBe(true)
        expect(validator.safeValidate(['everything']).valid).toBe(true)
        expect(validator.safeValidate(['nothing']).valid).toBe(true)
        expect(validator.safeValidate(['something']).valid).toBe(true)

        const validator2 = PermissionValidator.create().allOf(['namespace::resource.action:*'])

        expect(validator2.safeValidate(['namespace::resource.action:read']).valid).toBe(true)
        expect(validator2.safeValidate(['namespace::resource.action:write']).valid).toBe(true)
        expect(validator2.safeValidate(['namespace::resource.action:delete']).valid).toBe(true)

        const validator3 = PermissionValidator.create().allOf(['namespace::resource.*:*'])

        expect(validator3.safeValidate(['namespace::resource.action:read']).valid).toBe(true)
        expect(validator3.safeValidate(['namespace::resource.action1:write']).valid).toBe(true)
        expect(validator3.safeValidate(['namespace::resource.action2:delete']).valid).toBe(true)
    })

    describe('Nested Permission Validators', () => {
        it('should support nesting validators with someOf for OR logic', () => {
            // Create nested validator: permission1 OR (permission2 AND permission3)
            const nestedValidator = PermissionValidator.create().allOf(['permission2', 'permission3'])
            const validator = PermissionValidator.create().someOf(
                ['permission1', nestedValidator],
                'Need permission1 OR (permission2 AND permission3)',
            )

            // Test with permission1 only - should pass
            expect(validator.safeValidate(['permission1']).valid).toBe(true)

            // Test with permission2 and permission3 - should pass
            expect(validator.safeValidate(['permission2', 'permission3']).valid).toBe(true)

            // Test with all permissions - should pass
            expect(validator.safeValidate(['permission1', 'permission2', 'permission3']).valid).toBe(true)

            // Test with permission2 only - should fail
            expect(validator.safeValidate(['permission2']).valid).toBe(false)

            // Test with permission3 only - should fail
            expect(validator.safeValidate(['permission3']).valid).toBe(false)

            // Test with no permissions - should fail
            expect(validator.safeValidate([]).valid).toBe(false)
        })

        it('should support nesting validators with allOf for AND logic', () => {
            // Create nested validator: permission1 AND (permission2 OR permission3)
            const nestedValidator = PermissionValidator.create().someOf(['permission2', 'permission3'])
            const validator = PermissionValidator.create().allOf(
                ['permission1', nestedValidator],
                'Need permission1 AND (permission2 OR permission3)',
            )

            // Test with permission1 and permission2 - should pass
            expect(validator.safeValidate(['permission1', 'permission2']).valid).toBe(true)

            // Test with permission1 and permission3 - should pass
            expect(validator.safeValidate(['permission1', 'permission3']).valid).toBe(true)

            // Test with all permissions - should pass
            expect(validator.safeValidate(['permission1', 'permission2', 'permission3']).valid).toBe(true)

            // Test with permission1 only - should fail
            expect(validator.safeValidate(['permission1']).valid).toBe(false)

            // Test with permission2 only - should fail
            expect(validator.safeValidate(['permission2']).valid).toBe(false)

            // Test with permission2 and permission3 only - should fail
            expect(validator.safeValidate(['permission2', 'permission3']).valid).toBe(false)
        })

        it('should support multiple levels of nesting', () => {
            // Create complex nested validator: permission1 OR (permission2 AND (permission3 OR permission4))
            const deepNestedValidator = PermissionValidator.create().someOf(['permission3', 'permission4'])
            const nestedValidator = PermissionValidator.create().allOf(['permission2', deepNestedValidator])
            const validator = PermissionValidator.create().someOf(
                ['permission1', nestedValidator],
                'Complex permission logic failed',
            )

            // Test with permission1 only - should pass
            expect(validator.safeValidate(['permission1']).valid).toBe(true)

            // Test with permission2 and permission3 - should pass
            expect(validator.safeValidate(['permission2', 'permission3']).valid).toBe(true)

            // Test with permission2 and permission4 - should pass
            expect(validator.safeValidate(['permission2', 'permission4']).valid).toBe(true)

            // Test with permission2, permission3, and permission4 - should pass
            expect(validator.safeValidate(['permission2', 'permission3', 'permission4']).valid).toBe(true)

            // Test with permission2 only - should fail
            expect(validator.safeValidate(['permission2']).valid).toBe(false)

            // Test with permission3 and permission4 only - should fail
            expect(validator.safeValidate(['permission3', 'permission4']).valid).toBe(false)
        })

        it('should support nesting with noneOf for exclusion logic', () => {
            // Create validator: permission1 AND NOT(permission2 OR permission3)
            const excludeValidator = PermissionValidator.create().someOf(['permission2', 'permission3'])
            const validator = PermissionValidator.create()
                .allOf(['permission1'], 'Must have permission1')
                .noneOf([excludeValidator], 'Cannot have permission2 or permission3')

            // Test with permission1 only - should pass
            expect(validator.safeValidate(['permission1']).valid).toBe(true)

            // Test with permission1 and permission4 - should pass
            expect(validator.safeValidate(['permission1', 'permission4']).valid).toBe(true)

            // Test with permission1 and permission2 - should fail
            expect(validator.safeValidate(['permission1', 'permission2']).valid).toBe(false)

            // Test with permission1 and permission3 - should fail
            expect(validator.safeValidate(['permission1', 'permission3']).valid).toBe(false)

            // Test with permission1, permission2, and permission3 - should fail
            expect(validator.safeValidate(['permission1', 'permission2', 'permission3']).valid).toBe(false)
        })

        it('should provide meaningful error messages for nested validators', () => {
            const nestedValidator = PermissionValidator.create().allOf(
                ['permission2', 'permission3'],
                'Missing required permissions 2 and 3',
            )
            const validator = PermissionValidator.create().someOf(
                ['permission1', nestedValidator],
                'Need permission1 OR both permission2 and permission3',
            )

            const result = validator.safeValidate(['permission2'])

            expect(result.valid).toBe(false)
            expect(result.errorMessage).toBe('Need permission1 OR both permission2 and permission3')
            expect(result.errors).toHaveLength(1)
        })

        it('should work with real-world permission patterns using nesting', () => {
            // Create validator for: write:all OR (create:all AND update:all)
            const createAndUpdate = PermissionValidator.create().allOf(['create:all', 'update:all'])
            const validator = PermissionValidator.create().someOf(
                ['write:all', createAndUpdate],
                'Need write:all OR (create:all AND update:all)',
            )

            // Test with write:all - should pass
            expect(validator.safeValidate(['write:all']).valid).toBe(true)

            // Test with create:all and update:all - should pass
            expect(validator.safeValidate(['create:all', 'update:all']).valid).toBe(true)

            // Test with all permissions - should pass
            expect(validator.safeValidate(['write:all', 'create:all', 'update:all']).valid).toBe(true)

            // Test with create:all only - should fail
            expect(validator.safeValidate(['create:all']).valid).toBe(false)

            // Test with update:all only - should fail
            expect(validator.safeValidate(['update:all']).valid).toBe(false)

            // Test with read:all - should fail
            expect(validator.safeValidate(['read:all']).valid).toBe(false)
        })

        it('should support the exact syntax mentioned: someOf with nested allOf for OR-AND logic', () => {
            // Test the exact pattern: baseValidator.someOf(['permission1', baseValidator.someOf(['permission2', 'permission3'])])
            // This creates: permission1 OR (permission2 AND permission3)
            const nestedValidator = PermissionValidator.create().allOf(['permission2', 'permission3'])
            const validator = PermissionValidator.create().someOf(['permission1', nestedValidator])

            // Test permission1 only - should pass
            expect(validator.safeValidate(['permission1']).valid).toBe(true)

            // Test permission2 and permission3 - should pass
            expect(validator.safeValidate(['permission2', 'permission3']).valid).toBe(true)

            // Test all permissions - should pass
            expect(validator.safeValidate(['permission1', 'permission2', 'permission3']).valid).toBe(true)

            // Test permission2 only - should fail
            expect(validator.safeValidate(['permission2']).valid).toBe(false)

            // Test permission3 only - should fail
            expect(validator.safeValidate(['permission3']).valid).toBe(false)

            // Test no permissions - should fail
            expect(validator.safeValidate([]).valid).toBe(false)
        })

        it('should work with wildcards in nested validators', () => {
            // Create validator: admin:* OR (books:read AND books:write)
            const booksReadWrite = PermissionValidator.create().allOf(['books:read', 'books:write'])
            const validator = PermissionValidator.create().someOf(
                ['admin:*', booksReadWrite],
                'Need admin access OR books read/write',
            )

            // Test with admin wildcard - should pass
            expect(validator.safeValidate(['admin:read']).valid).toBe(true)
            expect(validator.safeValidate(['admin:write']).valid).toBe(true)
            expect(validator.safeValidate(['admin:delete']).valid).toBe(true)

            // Test with books read and write - should pass
            expect(validator.safeValidate(['books:read', 'books:write']).valid).toBe(true)

            // Test with books read only - should fail
            expect(validator.safeValidate(['books:read']).valid).toBe(false)

            // Test with books write only - should fail
            expect(validator.safeValidate(['books:write']).valid).toBe(false)

            // Test with other permissions - should fail
            expect(validator.safeValidate(['users:read']).valid).toBe(false)
        })

        it('should demonstrate practical usage for upsert/bulkUpsert permissions', () => {
            // Create validator for upsert/bulkUpsert: books:write:all OR (books:create:all AND books:update:all)
            const createAndUpdate = PermissionValidator.create().allOf(['books:create:all', 'books:update:all'])
            const upsertValidator = PermissionValidator.create().someOf(
                ['books:write:all', createAndUpdate],
                'Need books:write:all OR (books:create:all AND books:update:all)',
            )

            // Test with write permission - should pass
            expect(upsertValidator.safeValidate(['books:write:all']).valid).toBe(true)

            // Test with create and update permissions - should pass
            expect(upsertValidator.safeValidate(['books:create:all', 'books:update:all']).valid).toBe(true)

            // Test with all permissions - should pass
            expect(
                upsertValidator.safeValidate(['books:write:all', 'books:create:all', 'books:update:all']).valid,
            ).toBe(true)

            // Test with create only - should fail
            expect(upsertValidator.safeValidate(['books:create:all']).valid).toBe(false)

            // Test with update only - should fail
            expect(upsertValidator.safeValidate(['books:update:all']).valid).toBe(false)

            // Test with read only - should fail
            expect(upsertValidator.safeValidate(['books:read:all']).valid).toBe(false)

            // Test error message
            const result = upsertValidator.safeValidate(['books:create:all'])
            expect(result.valid).toBe(false)
            expect(result.errorMessage).toBe('Need books:write:all OR (books:create:all AND books:update:all)')
        })
    })
})
