import { Context } from '../context/context'
import { createRequest } from 'node-mocks-http'
import { provideRequest, useRequest, useRequestMethod } from './request'
import { describe, expect, it } from 'vitest'

describe('Http Request', () => {
    it('Should get undefined by default', () => {
        const context = new Context()

        const request = useRequest(context)

        expect(request).toBeUndefined()
    })
    it('Should provide a request', () => {
        const context = new Context()

        const request = createRequest({
            method: 'GET',
            url: '/test',
            headers: {
                'Content-Type': 'application/json',
                'X-Test': 'test',
                Authorization: 'Bearer 123',
            },
        })

        provideRequest(context, request)

        const request2 = useRequest(context)

        expect(request2).toEqual(request)
    })

    it('Should get the method', () => {
        const context = new Context()

        const request = createRequest({
            method: 'GET',
            url: '/test',
            headers: {
                'Content-Type': 'application/json',
                'X-Test': 'test',
            },
        })

        provideRequest(context, request)

        const method = useRequestMethod(context)

        expect(method).toEqual('GET')
    })
})
