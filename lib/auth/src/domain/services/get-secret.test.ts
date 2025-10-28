import { beforeEach, afterEach, describe, expect, it } from 'bun:test'
import type { AuthService } from './auth-service'
import { MockAuthService } from '../../test/mock/auth-service'

describe('AuthService.getSecret', () => {
    let previousNodeEnv: string | undefined
    let previousAppSecret: string | undefined

    beforeEach(() => {
        previousNodeEnv = process.env.NODE_ENV
        previousAppSecret = process.env.APP_SECRET
    })

    afterEach(() => {
        process.env.NODE_ENV = previousNodeEnv
        process.env.APP_SECRET = previousAppSecret
    })

    it('should return the signingSecret from authConfig when provided', () => {
        const customSecret = 'custom-signing-secret'
        const config = { authTimeout: 3600, signingSecret: customSecret }
        const authService = new MockAuthService(config)

        expect(authService.getSecret()).toBe(customSecret)
    })

    it('should return APP_SECRET environment variable when signingSecret is not provided', () => {
        const envSecret = 'env-secret-value'
        process.env.APP_SECRET = envSecret
        const config = { authTimeout: 3600 }
        const authService = new MockAuthService(config)

        expect(authService.getSecret()).toBe(envSecret)
    })

    it('should prioritize signingSecret over APP_SECRET environment variable', () => {
        const signingSecret = 'signing-secret'
        const envSecret = 'env-secret'
        process.env.APP_SECRET = envSecret
        const config = { authTimeout: 3600, signingSecret }
        const authService = new MockAuthService(config)

        expect(authService.getSecret()).toBe(signingSecret)
    })

    it('should return default secret in test environment when no secret is configured', () => {
        process.env.NODE_ENV = 'test'
        delete process.env.APP_SECRET
        const config = { authTimeout: 3600 }
        const authService = new MockAuthService(config)

        expect(authService.getSecret()).toBe('shhhhh')
    })

    it('should return default secret in development environment when no secret is configured', () => {
        process.env.NODE_ENV = 'development'
        delete process.env.APP_SECRET
        const config = { authTimeout: 3600 }
        const authService = new MockAuthService(config)

        expect(authService.getSecret()).toBe('shhhhh')
    })

    it('should return the configured secret in production environment', () => {
        const prodSecret = 'production-secret'
        process.env.NODE_ENV = 'production'
        delete process.env.APP_SECRET
        const config = { authTimeout: 3600, signingSecret: prodSecret }
        const authService = new MockAuthService(config)

        expect(authService.getSecret()).toBe(prodSecret)
    })
})
