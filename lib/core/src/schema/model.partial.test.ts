import { describe, expect, it } from 'bun:test'
import { z } from 'zod/v4'
import type { $ZodType } from 'zod/v4/core'
import type { IAnyModel } from './model'
import { MockModel } from './test/mock-model'

/**
 * A model that counts how often its partial companion is built, so tests can prove the result is
 * memoized rather than rebuilt on every call.
 */
class CountingModel<TName extends Readonly<string>, TSchema extends $ZodType<any>> extends MockModel<TName, TSchema> {
    public builds = 0

    constructor(
        name: TName,
        schema: TSchema,
        private readonly partialFactory?: () => IAnyModel,
    ) {
        super(name, schema)
    }

    protected override buildPartialModel(): IAnyModel | undefined {
        this.builds++
        return this.partialFactory?.()
    }
}

describe('Model.partial', () => {
    it('should return undefined when the model cannot derive a partial of itself', () => {
        // MockModel does not override buildPartialModel, so it has the base behaviour.
        const model = new MockModel('User', z.object({ id: z.string() }))

        expect(model.partial()).toBeUndefined()
    })

    it('should return the model the subclass builds', () => {
        const companion = new MockModel('User', z.object({ id: z.string().optional() }))
        const model = new CountingModel('User', z.object({ id: z.string() }), () => companion)

        expect(model.partial()).toBe(companion)
    })

    it('should build the partial companion once and reuse it', () => {
        const model = new CountingModel('User', z.object({ id: z.string() }), () => {
            return new MockModel('User', z.object({ id: z.string().optional() }))
        })

        const first = model.partial()
        const second = model.partial()

        expect(first).toBe(second!)
        expect(model.builds).toBe(1)
    })

    it('should also remember that a partial could not be built', () => {
        const model = new CountingModel('User', z.object({ id: z.string() }))

        expect(model.partial()).toBeUndefined()
        expect(model.partial()).toBeUndefined()
        expect(model.builds).toBe(1)
    })
})
