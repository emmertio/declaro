import type { AuthConfig } from '../../domain/interfaces/auth-config'

export const mockAuthConfig: AuthConfig = {
    authTimeout: 3600, // 1 hour in seconds
    signingSecret: 'shhhhh',
}
