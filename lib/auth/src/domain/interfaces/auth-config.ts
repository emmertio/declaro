export interface AuthConfig {
    /**
     * The duration (in seconds) for which the authentication session is valid.
     */
    authTimeout: number // in seconds

    /**
     * The secret key used for signing and verifying JWT tokens.
     */
    signingSecret?: string
}
