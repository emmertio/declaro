import { describe, expect, it, vi } from 'vitest'
import { initialInput, Pipeline } from './pipeline'
import { pipelineAction } from './pipeline-action'

describe('Pipelines', () => {
    type Meta = {
        positive: boolean
        negative: boolean
        zero: boolean
        number: number
    }

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
        const divide = (divisor: number) => async (input: number) => input / divisor
        const toString = (input: number) => input.toString()

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

        const pipeline = basePipeline.pipe(fromString).pipe(multiply(8)).pipe(divide(4)).pipe(toString)

        const result = await pipeline.execute('1')
        const baseResult = await basePipeline.execute('1')

        expect(result).toBe('4')
        expect(baseResult).toBe('2')
    })

    it('should execute a diverged pipeline', () => {
        const add = vi.fn((increment: number) => (input: number) => input + increment)
        const meta = vi.fn(
            (number: number): Meta => ({
                positive: number > 0,
                negative: number < 0,
                zero: number === 0,
                number,
            }),
        )
        const message = vi.fn((meta?: Meta) =>
            meta?.positive
                ? `${meta.number} is positive`
                : meta.negative
                ? `${meta.number} is negative`
                : meta.zero
                ? `${meta.number} is zero`
                : `${meta.number} is not a number`,
        )

        const originalPipeline = new Pipeline(initialInput<number>()).pipe(meta)

        const divergedPipeline = originalPipeline.diverge((input) => {
            if (input.positive) {
                return new Pipeline(initialInput<Meta>())
                    .pipe((m) => m.number)
                    .pipe(add(-1))
                    .pipe(meta)
                    .export()
            } else if (input.negative) {
                return new Pipeline(initialInput<Meta>())
                    .pipe((m) => m.number)
                    .pipe(add(1))
                    .pipe(meta)
                    .export()
            } else if (input.zero) {
                return new Pipeline(initialInput<Meta>()).pipe(message).export()
            } else {
                return new Pipeline(initialInput<Meta>()).pipe(message).export()
            }
        })

        const convergedPipeline = divergedPipeline.pipe(message)

        const result1 = divergedPipeline.execute(12)
        const result2 = divergedPipeline.execute(-4)

        const result3 = convergedPipeline.execute(6)

        expect(result1).toStrictEqual({
            positive: true,
            negative: false,
            zero: false,
            number: 11,
        })
        expect(result2).toStrictEqual({
            positive: false,
            negative: true,
            zero: false,
            number: -3,
        })
        expect(result3).toBe('5 is positive')
    })

    it('should support recursive pipelines', () => {
        const add = vi.fn((increment: number) => (input: number) => input + increment)
        const meta = vi.fn(
            (number: number): Meta => ({
                positive: number > 0,
                negative: number < 0,
                zero: number === 0,
                number,
            }),
        )
        const message = vi.fn((meta?: Meta | string) => {
            if (typeof meta === 'string') {
                return meta
            }

            return meta?.positive
                ? `${meta.number} is positive`
                : meta.negative
                ? `${meta.number} is negative`
                : meta.zero
                ? `${meta.number} is zero`
                : `${meta.number} is not a number`
        })

        const originalPipeline = new Pipeline(initialInput<number>()).pipe(meta)

        const calculatePipeline = new Pipeline(initialInput<Meta>()).diverge((input) => {
            if (input.positive) {
                return new Pipeline(initialInput<Meta>())
                    .pipe((m) => m.number)
                    .pipe(add(-1))
                    .pipe(meta)
                    .export()
            } else if (input.negative) {
                return new Pipeline(initialInput<Meta>())
                    .pipe((m) => m.number)
                    .pipe(add(1))
                    .pipe(meta)
                    .export()
            } else if (input.zero) {
                return new Pipeline(initialInput<Meta>()).pipe(message).export()
            } else {
                return new Pipeline(initialInput<Meta>()).pipe(message).export()
            }
        })

        const recursivePipeline = calculatePipeline.diverge((input) => {
            if (typeof input === 'string') {
                return (text) => text
            } else {
                return recursivePipeline.export()
            }
        })

        const pipeline = originalPipeline.pipe(recursivePipeline.export())

        const result1 = pipeline.execute(12)

        expect(result1).toBe('0 is zero')
        expect(add).toHaveBeenCalledTimes(12)
        expect(meta).toHaveBeenCalledTimes(13)
        expect(message).toHaveBeenCalledTimes(1)

        const result2 = pipeline.execute(-4)

        expect(result2).toBe('0 is zero')
        expect(add).toHaveBeenCalledTimes(16)
        expect(meta).toHaveBeenCalledTimes(18)
        expect(message).toHaveBeenCalledTimes(2)

        const result3 = pipeline.execute(0)

        expect(result3).toBe('0 is zero')
        expect(add).toHaveBeenCalledTimes(16)
        expect(meta).toHaveBeenCalledTimes(19)
        expect(message).toHaveBeenCalledTimes(3)
    })
})
