import { describe, expect, it } from 'vitest'
import { TypescriptMap } from './supported-types'

describe('Supported types', async () => {
    it('should support scalar types', async () => {
        expect(TypescriptMap.string).toBe('string')
        expect(TypescriptMap.text).toBe('string')

        expect(TypescriptMap.integer).toBe('number')
        expect(TypescriptMap.number).toBe('number')
        expect(TypescriptMap.float).toBe('number')
        expect(TypescriptMap.double).toBe('number')

        expect(TypescriptMap.boolean).toBe('boolean')

        expect(TypescriptMap.date).toBe('Date')
        expect(TypescriptMap.datetime).toBe('Date')
        expect(TypescriptMap.time).toBe('Date')
    })
})
