import { AppScope, RequestScope } from '@declaro/core'
import type { IAuthSession } from '../domain/models/auth-session'
import type { AuthService } from '../domain/services/auth-service'
import type { AuthConfig } from '../domain/interfaces/auth-config'

declare module '@declaro/core' {
    export interface AppScope {
        authConfig: AuthConfig
        authService: Promise<AuthService>
        authSession: Promise<IAuthSession | null>
    }

    export interface RequestScope {}
}
