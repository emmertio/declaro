import { describe, expect, it } from 'vitest'
import { Pipeline } from './pipeline'

describe('Pipelines', () => {
    it('should create and execute an initial pipeline', () => {
        const pipeline = new Pipeline((input: number) => input + 1)

        const result = pipeline.execute(1)

        expect(result).toBe(2)
    })

    it('should support async pipelines', async () => {
        const pipeline = new Pipeline(async (input: number) => input + 1)

        const result = await pipeline.execute(1)

        expect(result).toBe(2)
    })

    it('should support chaining multiple actions into a pipeline', async () => {
        const fromString = (input: string) => parseInt(input)
        const add = (increment: number) => (input: number) => input + increment
        const multiply = (factor: number) => (input: number) => input * factor
        const divide = (divisor: number) => (input: number) => input / divisor
        const toString = (input: number) => input.toString()

        const pipeline = new Pipeline(fromString)
            .pipe(add(1))
            .pipe(toString)
            .pipe(fromString)
            .pipe(multiply(8))
            .pipe(divide(4))
            .pipe(toString)

        const result = pipeline.execute('1')

        expect(result).toBe('4')
    })

    it('should support chaining multiple async/sync actions into a pipeline', async () => {
        const fromString = async (input: string) => parseInt(input)
        const add = (increment: number) => (input: number) => input + increment
        const multiply = (factor: number) => (input: number) => input * factor
        const divide = (divisor: number) => (input: number) => input / divisor
        const toString = async (input: number) => input.toString()

        const pipeline = new Pipeline(fromString)
            .pipe(add(1))
            .pipe(toString)
            .pipe(fromString)
            .pipe(multiply(8))
            .pipe(divide(4))
            .pipe(toString)

        const result = await pipeline.execute('1')

        expect(result).toBe('4')
    })

    it('should support forking pipelines', async () => {
        const fromString = async (input: string) => parseInt(input)
        const add = (increment: number) => (input: number) => input + increment
        const multiply = (factor: number) => (input: number) => input * factor
        const divide = (divisor: number) => (input: number) => input / divisor
        const toString = async (input: number) => input.toString()

        const basePipeline = new Pipeline(fromString).pipe(add(1)).pipe(toString)

        const pipeline = basePipeline.fork().pipe(fromString).pipe(multiply(8)).pipe(divide(4)).pipe(toString)

        const result = await pipeline.execute('1')
        const baseResult = await basePipeline.execute('1')

        expect(result).toBe('4')
        expect(baseResult).toBe('2')
    })
})
