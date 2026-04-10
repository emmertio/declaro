import jwt from 'jsonwebtoken'
import { v4 as uuid } from 'uuid'
import type { IAuthPayload, IAuthSession, IAuthSessionInput } from '../models/auth-session'
import { ForbiddenError } from '@declaro/core'
import type { AuthConfig } from '../interfaces/auth-config'
import { DateTime } from 'luxon'

export abstract class AuthService {
    protected readonly sessionPrefix: string = 'auth-session'

    constructor(protected readonly authConfig: AuthConfig) {}

    async createSession(payload: IAuthSessionInput): Promise<IAuthSession> {
        const now = DateTime.now()
        const session: IAuthSession = {
            id: this.getSessionId(payload),
            jwt: payload.jwt,
            jwtPayload: this.decodeJWT(payload.jwt),
            issued: now.toJSDate(),
            expires: now.plus({ seconds: this.authConfig.authTimeout }).toJSDate(),
            roles: payload.roles ?? [],
            claims: payload.claims ?? [],
            memberships: payload.memberships ?? [],
        }

        await this.saveSession(session)

        return session
    }

    decodeJWT(token: string): IAuthPayload {
        const result = jwt.decode(token)

        if (!result || typeof result !== 'object') {
            throw new ForbiddenError('Invalid JWT token')
        }

        return result as IAuthPayload
    }

    validateJWT(token: string): IAuthPayload {
        const preliminaryPayload = this.decodeJWT(token)

        if (preliminaryPayload?.exp && preliminaryPayload.exp < new Date().getTime() / 1000) {
            throw new ForbiddenError('JWT token has expired')
        }

        try {
            const result = jwt.verify(token, this.getSecret())

            if (!result || typeof result !== 'object') {
                throw new ForbiddenError('Invalid JWT token')
            }

            return result as IAuthPayload
        } catch (error) {
            throw new ForbiddenError('JWT token is invalid', error)
        }
    }

    getSecret(): string {
        const secret = this.authConfig.signingSecret ?? process.env.APP_SECRET
        if (!secret && process.env.NODE_ENV !== 'test') {
            console.warn('APP_SECRET is not set, using a default secret for development purposes.')
        }
        if (!secret && process.env.NODE_ENV !== 'production') {
            return 'shhhhh'
        }
        return secret!
    }

    getSessionId(payload?: IAuthSessionInput) {
        return payload?.id ?? `${this.sessionPrefix}-${uuid()}`
    }

    abstract saveSession(session: IAuthSession): Promise<IAuthSession>
    abstract getSession(id: string): Promise<IAuthSession | null>
    abstract deleteSession(id: string): Promise<void>
}
