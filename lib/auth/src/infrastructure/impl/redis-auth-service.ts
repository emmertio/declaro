import { serialize, unserialize } from '@declaro/redis'
import { Redis } from 'ioredis'
import type { IAuthSession } from '../../domain/models/auth-session'
import { AuthService } from '../../domain/services/auth-service'
import { SystemError } from '@declaro/core'
import type { AuthConfig } from '../../domain/interfaces/auth-config'

export class RedisAuthService extends AuthService {
    constructor(authConfig: AuthConfig, protected readonly redis: Redis) {
        super(authConfig)
    }

    async saveSession(session: IAuthSession): Promise<IAuthSession> {
        const id = this.getSessionId(session)
        const payload = serialize(session)

        const now = new Date()
        const lifetime = Math.ceil((session.expires.getTime() - now.getTime()) / 1000)

        await this.redis.setex(id, lifetime, payload)

        const newSession = await this.getSession(id)

        if (!newSession) {
            throw new SystemError('Failed to save session in Redis')
        }

        return newSession
    }

    async getSession(id: string): Promise<IAuthSession | null> {
        const result = await this.redis.get(id)

        const session = unserialize<IAuthSession>(result)

        if (session) {
            session.expires = new Date(session.expires)
            session.issued = new Date(session.issued)
        }

        return session ?? null
    }

    async deleteSession(id: string): Promise<void> {
        await this.redis.del(id)
    }
}
