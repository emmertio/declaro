import { beforeEach, describe, expect, it } from 'vitest'
import { Context, type ContextMiddleware } from '../context/context'
import { provideRequestMiddleware, useRequestMiddleware } from './request-context'

describe('Http Request Context', () => {
    let context: Context

    beforeEach(() => {
        context = new Context()
    })

    it('Should have nothing by default', () => {
        const initialMiddleware = useRequestMiddleware(context)
        expect(initialMiddleware.length).toEqual(0)
    })

    it('Should provide a middleware', () => {
        const middleware1: ContextMiddleware = (context) => {
            context.provide('test', 'test')
        }
        const middleware2: ContextMiddleware = (context) => {
            context.provide('test2', 'test2')
        }

        provideRequestMiddleware(context, middleware1, middleware2)

        const mwList = useRequestMiddleware(context)

        expect(mwList.length).toEqual(2)

        mwList.forEach((mw) => mw(context))

        const val1 = context.inject('test')
        const val2 = context.inject('test2')

        expect(val1).toEqual('test')
        expect(val2).toEqual('test2')
    })
})
