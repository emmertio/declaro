import type Redis from 'ioredis'
import type { AuthConfig } from '../domain/interfaces/auth-config'
import type { AuthService } from '../domain/services/auth-service'

export interface AuthDependencies {
    redis: Promise<Redis>
}

export interface AuthContext {
    /**
     * The configuration for authentication, including settings like auth timeout.
     */
    authConfig: AuthConfig

    /**
     * The AuthService instance used for authentication operations.
     */
    authService: Promise<AuthService>
}
