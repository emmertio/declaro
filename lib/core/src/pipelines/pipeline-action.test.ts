import { describe, expect, it } from 'vitest'
import { pipelineAction } from './pipeline-action'
import { Pipeline } from './pipeline'

describe('Pipeline Actions', () => {
    it('should define pipeline actions', async () => {
        const add = (increment: number) => pipelineAction((input: number) => input + increment)
        const multiply = (factor: number) => pipelineAction((input: number) => input * factor)
        const divide = (divisor: number) => pipelineAction((input: number) => input / divisor)
        const formatResponse = async (input: number) => JSON.stringify({ result: input })

        const pipeline = new Pipeline(add(1)).pipe(multiply(8)).pipe(divide(4)).pipe(formatResponse)

        const result = await pipeline.execute(1)

        expect(result).toBe('{"result":4}')
    })
})
