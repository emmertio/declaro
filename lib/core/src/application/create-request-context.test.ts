import { createRequest } from 'node-mocks-http'
import { beforeEach, describe, expect, it } from 'vitest'
import { Context, type DeclaroRequestScope, type DeclaroScope } from '../context/context'
import type { Request } from '../http/request'
import { createRequestContext } from './create-request-context'
import { useDeclaro } from './use-declaro'

// Extended scopes for testing
interface TestAppScope extends DeclaroScope {
    testAppValue?: string
    sharedKey?: string
    appValue?: string
    appFactory?: string
    appClass?: TestClass
    eagerDep?: string
}

interface TestRequestScope extends DeclaroRequestScope {
    middlewareTest?: string
    asyncTest?: string
    middleware1?: string
    middleware2?: string
    sharedKey?: string
    appValue?: string
    appFactory?: string
    appClass?: TestClass
}

class TestClass {
    getValue() {
        return 'class-result'
    }
}

describe('createRequestContext', () => {
    let appContext: Context<TestAppScope>
    let mockRequest: Request

    beforeEach(async () => {
        // Create app context with Declaro middleware
        appContext = new Context<TestAppScope>()
        await appContext.use(useDeclaro())

        // Create mock request
        mockRequest = createRequest({
            method: 'POST',
            url: 'https://example.com/api/test?param1=value1&param2=value2',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer test-token-123',
                'X-Custom-Header': 'custom-value',
                'User-Agent': 'test-agent/1.0',
            },
            body: {
                test: 'data',
            },
        }) as Request
    })

    describe('basic functionality', () => {
        it('should create a request context from app context', async () => {
            const requestContext = await createRequestContext(appContext, mockRequest)

            expect(requestContext).toBeInstanceOf(Context)
            expect(requestContext).not.toBe(appContext)
        })

        it('should extend the app context', async () => {
            // Add a value to app context
            appContext.registerValue('testAppValue', 'app-test-value')

            const requestContext = (await createRequestContext(appContext, mockRequest)) as Context<TestRequestScope>

            // Should be able to access app context values
            expect((requestContext as any).resolve('testAppValue')).toBe('app-test-value')
        })

        it('should run request middleware', async () => {
            let middlewareRan = false

            appContext.scope.requestMiddleware.push((context) => {
                middlewareRan = true
                ;(context as any).registerValue('middlewareTest', 'middleware-value')
            })

            const requestContext = await createRequestContext(appContext, mockRequest)

            expect(middlewareRan).toBe(true)
            expect((requestContext as any).resolve('middlewareTest')).toBe('middleware-value')
        })

        it('should initialize eager dependencies', async () => {
            let eagerFactoryRan = false

            appContext.registerFactory(
                'eagerDep',
                () => {
                    eagerFactoryRan = true
                    return 'eager-value'
                },
                [],
                { eager: true },
            )

            await createRequestContext(appContext, mockRequest)

            expect(eagerFactoryRan).toBe(true)
        })
    })

    describe('request injection', () => {
        it('should inject the request object', async () => {
            const requestContext = await createRequestContext(appContext, mockRequest)

            const injectedRequest = requestContext.resolve('request')

            expect(injectedRequest).toBe(mockRequest)
            expect(injectedRequest.method).toBe('POST')
            expect(injectedRequest.url).toBe('https://example.com/api/test?param1=value1&param2=value2')
        })

        it('should provide request via scope property', async () => {
            const requestContext = await createRequestContext(appContext, mockRequest)

            expect(requestContext.scope.request).toBe(mockRequest)
        })
    })

    describe('headers injection', () => {
        it('should inject headers object', async () => {
            const requestContext = await createRequestContext(appContext, mockRequest)

            const headers = requestContext.resolve('headers')

            expect(headers).toBeDefined()
            expect(headers['content-type']).toBe('application/json')
            expect(headers['authorization']).toBe('Bearer test-token-123')
            expect(headers['x-custom-header']).toBe('custom-value')
            expect(headers['user-agent']).toBe('test-agent/1.0')
        })

        it('should provide headers via scope property', async () => {
            const requestContext = await createRequestContext(appContext, mockRequest)

            expect(requestContext.scope.headers).toBeDefined()
            expect(requestContext.scope.headers).toBe(mockRequest.headers)
        })

        it('should handle missing headers gracefully', async () => {
            const requestWithoutHeaders = createRequest({
                method: 'GET',
                url: '/test',
                // No headers
            }) as Request

            const requestContext = await createRequestContext(appContext, requestWithoutHeaders)

            const headers = requestContext.resolve('headers')
            expect(headers).toBeDefined()
            expect(Object.keys(headers).length).toBeGreaterThanOrEqual(0)
        })
    })

    describe('header function injection', () => {
        it('should inject header function', async () => {
            const requestContext = await createRequestContext(appContext, mockRequest)

            const headerFunction = requestContext.resolve('header')

            expect(typeof headerFunction).toBe('function')
        })

        it('should provide header function via scope property', async () => {
            const requestContext = await createRequestContext(appContext, mockRequest)

            expect(typeof requestContext.scope.header).toBe('function')
        })

        it('should retrieve specific headers', async () => {
            const requestContext = await createRequestContext(appContext, mockRequest)

            const header = requestContext.scope.header

            expect(header('content-type')).toBe('application/json')
            expect(header('authorization')).toBe('Bearer test-token-123')
            expect(header('x-custom-header')).toBe('custom-value')
            expect(header('user-agent')).toBe('test-agent/1.0')
        })

        it('should return undefined for non-existent headers', async () => {
            const requestContext = await createRequestContext(appContext, mockRequest)

            const header = requestContext.scope.header

            expect(header('non-existent-header' as any)).toBeUndefined()
        })

        it('should handle case-insensitive header names', async () => {
            const requestContext = await createRequestContext(appContext, mockRequest)

            const header = requestContext.scope.header

            // HTTP headers are case-insensitive, Node.js typically lowercases them
            expect(header('Content-Type' as any)).toBe('application/json')
        })
    })

    describe('middleware arrays injection', () => {
        it('should inject requestMiddleware array', async () => {
            const requestContext = await createRequestContext(appContext, mockRequest)

            const requestMiddleware = requestContext.resolve('requestMiddleware')

            expect(Array.isArray(requestMiddleware)).toBe(true)
        })

        it('should inject nodeMiddleware array', async () => {
            const requestContext = await createRequestContext(appContext, mockRequest)

            const nodeMiddleware = requestContext.resolve('nodeMiddleware')

            expect(Array.isArray(nodeMiddleware)).toBe(true)
        })

        it('should provide middleware arrays via scope properties', async () => {
            const requestContext = await createRequestContext(appContext, mockRequest)

            expect(Array.isArray(requestContext.scope.requestMiddleware)).toBe(true)
            expect(Array.isArray(requestContext.scope.nodeMiddleware)).toBe(true)
        })
    })

    describe('type safety and scope validation', () => {
        it('should satisfy RequestScope interface', async () => {
            const requestContext = await createRequestContext(appContext, mockRequest)

            // Test that all RequestScope properties are available
            expect(requestContext.scope.request).toBeDefined()
            expect(requestContext.scope.headers).toBeDefined()
            expect(typeof requestContext.scope.header).toBe('function')
            expect(Array.isArray(requestContext.scope.requestMiddleware)).toBe(true)
            expect(Array.isArray(requestContext.scope.nodeMiddleware)).toBe(true)
        })

        it('should allow injection of all RequestScope dependencies', async () => {
            const requestContext = await createRequestContext(appContext, mockRequest)

            // Test direct resolution of all expected dependencies
            expect(() => requestContext.resolve('request')).not.toThrow()
            expect(() => requestContext.resolve('headers')).not.toThrow()
            expect(() => requestContext.resolve('header')).not.toThrow()
            expect(() => requestContext.resolve('requestMiddleware')).not.toThrow()
            expect(() => requestContext.resolve('nodeMiddleware')).not.toThrow()
        })
    })

    describe('dependency inheritance', () => {
        it('should inherit all app dependencies', async () => {
            // Register various types of dependencies in app context
            appContext.registerValue('appValue', 'test-value')
            appContext.registerFactory('appFactory', () => 'factory-result', [])
            ;(appContext as any).registerClass('appClass', TestClass, [])

            const requestContext = (await createRequestContext(appContext, mockRequest)) as Context<TestRequestScope>

            // All should be accessible in request context
            expect((requestContext as any).resolve('appValue')).toBe('test-value')
            expect((requestContext as any).resolve('appFactory')).toBe('factory-result')
            expect(((requestContext as any).resolve('appClass') as TestClass).getValue()).toBe('class-result')
        })

        it('should allow request context to override app dependencies', async () => {
            appContext.registerValue('sharedKey', 'app-value')

            // Add middleware that overrides the value
            appContext.scope.requestMiddleware.push((context) => {
                ;(context as any).registerValue('sharedKey', 'request-value')
            })

            const requestContext = await createRequestContext(appContext, mockRequest)

            expect((requestContext as any).resolve('sharedKey')).toBe('request-value')
        })
    })

    describe('error handling', () => {
        it('should handle middleware errors gracefully', async () => {
            // Add middleware that throws
            appContext.scope.requestMiddleware.push(() => {
                throw new Error('Middleware error')
            })

            await expect(createRequestContext(appContext, mockRequest)).rejects.toThrow('Middleware error')
        })

        it('should handle null/undefined request', async () => {
            // The current implementation doesn't validate the request parameter
            // It will set request to null and continue processing
            const requestContext = await createRequestContext(appContext, null as any)

            expect(requestContext.resolve('request')).toBeNull()
            expect(requestContext.resolve('headers')).toEqual({})
        })
    })

    describe('async middleware support', () => {
        it('should handle async middleware', async () => {
            let asyncMiddlewareRan = false

            appContext.scope.requestMiddleware.push(async (context) => {
                await new Promise((resolve) => setTimeout(resolve, 10))
                asyncMiddlewareRan = true
                ;(context as any).registerValue('asyncTest', 'async-result')
            })

            const requestContext = await createRequestContext(appContext, mockRequest)

            expect(asyncMiddlewareRan).toBe(true)
            expect((requestContext as any).resolve('asyncTest')).toBe('async-result')
        })

        it('should run multiple async middleware in sequence', async () => {
            const executionOrder: number[] = []

            appContext.scope.requestMiddleware.push(
                async (context) => {
                    await new Promise((resolve) => setTimeout(resolve, 20))
                    executionOrder.push(1)
                    ;(context as any).registerValue('middleware1', 'first')
                },
                async (context) => {
                    await new Promise((resolve) => setTimeout(resolve, 10))
                    executionOrder.push(2)
                    ;(context as any).registerValue('middleware2', 'second')
                },
            )

            const requestContext = await createRequestContext(appContext, mockRequest)

            expect(executionOrder).toEqual([1, 2])
            expect((requestContext as any).resolve('middleware1')).toBe('first')
            expect((requestContext as any).resolve('middleware2')).toBe('second')
        })
    })
})
