import { Context } from '../context/context'
import { useHeaders } from './headers'
import { createRequest } from 'node-mocks-http'
import { provideRequest } from './request'
import { describe, expect, it } from 'vitest'

describe('Http Headers', () => {
    const request = createRequest({
        method: 'GET',
        url: 'https://example.com/test',
        headers: {
            'Content-Type': 'application/json',
            'X-Test': 'test',
            Authorization: 'Bearer 123',
        },
    })

    it('Should get an empty object by default', () => {
        const context = new Context()

        const headers = useHeaders(context)

        expect(Object.keys(headers).length).toEqual(0)
    })

    // Provide some sample headers
    it('Should provide headers', () => {
        const context = new Context()

        provideRequest(context, request)

        const headers = useHeaders(context)

        expect(headers['content-type']).toEqual('application/json')
        expect(headers['x-test']).toEqual('test')
        expect(headers['authorization']).toEqual('Bearer 123')
    })

    it('Should use a single header', () => {
        const context = new Context()

        provideRequest(context, request)

        const headers = useHeaders(context)

        expect(headers['content-type']).toEqual('application/json')
    })
})
