// Re-export all browser-compatible exports
export * from './index.browser'

// Add Node.js-specific exports
export * from './infrastructure/impl/redis-auth-service'
export * from './domain/services/auth-service'
export * from './application/module'
export * from './test/mock/auth-service'
export * from './test/mock/auth-session'
export * from './test/mock/auth-config'
