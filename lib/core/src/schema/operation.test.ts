import { describe, it } from 'vitest'
import { defineOperation } from './operation'

describe('Operations', () => {
    it('should define an operation', () => {
        const op1 = defineOperation({
            summary: 'Get a user',
            description: 'Get a user by ID',
        })
    })
})
