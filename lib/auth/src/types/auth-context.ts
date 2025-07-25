import type Redis from 'ioredis'
import type { AuthConfig } from '../domain/interfaces/auth-config'
import type { IAuthSession } from '../domain/models/auth-session'
import type { AuthService } from '../domain/services/auth-service'
import type { AuthValidator } from '../shared/utils/auth-validator'
import type { DeclaroScope, DeclaroRequestScope } from '@declaro/core'

export interface AuthDependencies extends DeclaroScope {
    redis: Promise<Redis>
}

export interface AuthScope extends AuthDependencies {
    authConfig: AuthConfig
    authService: Promise<AuthService>
    authSession: Promise<IAuthSession | null>
}

export interface AuthRequestScope extends DeclaroRequestScope, AuthScope {
    authValidator: Promise<AuthValidator>
}
