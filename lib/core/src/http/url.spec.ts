// Tests for url.ts:
// Create tests for the following functions:
// - useURL: make sure it returns undefined by default, and the URL object if provided
// - provideURL: make sure you can provide a URL object or a string
// - useURLString: make sure it returns the stringified URL
// - useURLDomain: make sure it returns the domain part of the URL provided
// - useURLPath

import { Context } from '../context/context'
import { useRequestDomain, useRequestPath, useRequestQuery, useRequestURL, useRequestURLString } from './url'
import { provideRequest } from './request'
import { createRequest } from 'node-mocks-http'
import { describe, expect, it } from 'vitest'

// - useURLQueryString
describe('Http URL', () => {
    const testUrlString = 'https://example.com/test?a=1&b=2'
    const testUrlObject = new URL(testUrlString)
    const request = createRequest({
        method: 'GET',
        url: testUrlString,
        headers: {
            'Content-Type': 'application/json',
            'X-Test': 'test',
            Authorization: 'Bearer 123',
        },
    })

    it('Should get undefined by default', () => {
        const context = new Context()

        const url = useRequestURL(context)

        expect(url).toBeUndefined()
    })

    it('Should get the URL object if provided', () => {
        const context = new Context()

        provideRequest(context, request)

        const url2 = useRequestURL(context)

        expect(url2).toEqual(testUrlObject)
    })

    it('Should get the stringified URL', () => {
        const context = new Context()

        provideRequest(context, request)

        const url2 = useRequestURLString(context)

        expect(url2).toEqual(testUrlString)
    })

    it('Should get the domain part of the URL', () => {
        const context = new Context()

        provideRequest(context, request)

        const domain = useRequestDomain(context)

        expect(domain).toEqual('example.com')
    })

    it('Should get the path part of the URL', () => {
        const context = new Context()

        provideRequest(context, request)

        const path = useRequestPath(context)

        expect(path).toEqual('/test')
    })

    it('Should get the query string part of the URL', () => {
        const context = new Context()

        provideRequest(context, request)

        const query = useRequestQuery(context)

        expect(query['a']).toEqual('1')
        expect(query['b']).toEqual('2')
    })
})
