import { describe, expect, it } from 'vitest'
import { Pipeline } from './pipeline'
import { pipelineAction } from './pipeline-action'

describe('Pipeline Actions', () => {
    const add = (increment: number) => pipelineAction((input: number) => input + increment)
    const multiply = (factor: number) => pipelineAction((input: number) => input * factor)
    const divide = (divisor: number) => pipelineAction((input: number) => input / divisor)
    const formatResponse = async (input: number) => JSON.stringify({ result: input })

    it('should define pipeline actions', async () => {
        const pipeline = new Pipeline(add(1)).pipe(multiply(8)).pipe(divide(4)).pipe(formatResponse)

        const result = await pipeline.execute(1)

        expect(result).toBe('{"result":4}')
    })
})
