import { describe, expect, it } from 'vitest'
import { defineProperty } from './property'

describe('Properties', () => {
    it('should define a property', () => {
        const property = defineProperty({
            type: 'string',
            format: 'email',
        })

        expect()
    })
})
