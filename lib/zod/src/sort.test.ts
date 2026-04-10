import { describe, it, expect } from 'bun:test'
import { sortArray, sortObject, sortParameter } from './sort'
import { z } from 'zod/v4'

describe('Sort', () => {
    it('should create a schema for a sort property', async () => {
        const sortPropSchema = sortParameter()

        expect(sortPropSchema.safeParse('asc').success).toBe(true)
        expect(sortPropSchema.safeParse('desc').success).toBe(true)
        expect(sortPropSchema.safeParse('invalid').success).toBe(false)
        expect(sortPropSchema.safeParse('asc nulls first').success).toBe(true)
        expect(sortPropSchema.safeParse('asc nulls last').success).toBe(true)
        expect(sortPropSchema.safeParse('desc nulls first').success).toBe(true)
        expect(sortPropSchema.safeParse('desc nulls last').success).toBe(true)
        expect(sortPropSchema.safeParse(undefined).success).toBe(false)
    })

    it('should create a schema for a sort object', async () => {
        const Foo = z.object({
            title: z.string(),
            author: z.string(),
        })
        const sortObjectSchema = sortObject(['title', 'author'])
        const result = sortObjectSchema.safeParse({
            title: 'asc',
            author: 'desc',
        })

        expect(result.success).toBe(true)
        expect(result.data).toEqual({
            title: 'asc',
            author: 'desc',
        })

        const invalidResult = sortObjectSchema.safeParse({
            title: 'invalid',
            author: 'asc',
        })

        expect(invalidResult.success).toBe(false)
    })

    it('should create a schema for a sort array', async () => {
        const sortArraySchema = sortArray(['title', 'author'])
        const result = sortArraySchema.safeParse([
            { title: 'asc', author: 'desc' },
            { title: 'desc', author: 'asc' },
        ])

        expect(result.success).toBe(true)
        expect(result.data).toEqual([
            { title: 'asc', author: 'desc' },
            { title: 'desc', author: 'asc' },
        ])

        const invalidResult = sortArraySchema.safeParse([
            { title: 'invalid', author: 'desc' },
            { title: 'desc', author: 'asc' },
        ])

        expect(invalidResult.success).toBe(false)
    })
})
