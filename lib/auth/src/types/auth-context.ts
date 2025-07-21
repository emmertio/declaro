import type { AppScope, RequestScope } from '@declaro/core'
import type { IAuthSession } from '../domain/models/auth-session'
import type { AuthService } from '../domain/services/auth-service'
import type { AuthConfig } from '../domain/interfaces/auth-config'
import type { AuthValidator } from '../shared/utils/auth-validator'

declare module '@declaro/core' {
    export interface AppScope {
        authConfig: AuthConfig
        authService: Promise<AuthService>
        authSession: Promise<IAuthSession | null>
    }

    export interface RequestScope {
        authValidator: Promise<AuthValidator>
    }
}
