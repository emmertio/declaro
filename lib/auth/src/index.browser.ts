/**
 * Browser-specific exports for @declaro/auth
 * Excludes Node.js-specific implementations like Redis
 */

// Core domain models and interfaces - safe for browser
export * from './domain/models/auth-session'
export * from './domain/interfaces/auth-config'
export * from './domain/services/auth-service'

// Application module - safe for browser
export * from './application/module'

// Shared utilities and decorators - safe for browser
export * from './shared/utils/auth-validator'
export * from './shared/decorators/validate-permissions'

// Types - safe for browser
export * from './types/auth-context'

// Test mocks - safe for browser (useful for browser-based testing)
export * from './test/mock/auth-service'
export * from './test/mock/auth-session'
export * from './test/mock/auth-config'

// Note: infrastructure/impl/redis-auth-service is excluded as it requires Node.js-specific dependencies
