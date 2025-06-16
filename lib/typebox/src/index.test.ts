import { Type } from './index'
import { Value } from '@sinclair/typebox/value'
import { describe, expect, it } from 'bun:test'

describe('TypeBox', () => {
    it('should define a string format', () => {
        const UserSchema = Type.Object({
            email: Type.String({
                format: 'email',
            }),
        })

        expect(UserSchema.properties.email.format).toBe('email')
    })

    it('should define an html string', () => {
        const HTMLString = Type.String({
            format: 'html',
        })

        const valid = Value.Check(HTMLString, '<p>This is a <strong>valid</strong> HTML string.</p>')
        const invalid = Value.Check(HTMLString, '<p </ This is a <strong>bio</strong>.')

        expect(HTMLString.format).toBe('html')
        expect(valid).toBe(true)
        expect(invalid).toBe(false)
    })
})
