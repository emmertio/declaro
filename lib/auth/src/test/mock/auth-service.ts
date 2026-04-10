import type { IAuthSession } from '../../domain/models/auth-session'
import { AuthService } from '../../domain/services/auth-service'

export class MockAuthService extends AuthService {
    protected readonly sessions: Map<string, IAuthSession> = new Map()

    async saveSession(session: IAuthSession): Promise<IAuthSession> {
        this.sessions.set(session.id, session)
        return session
    }

    async getSession(id: string): Promise<IAuthSession | null> {
        return this.sessions.get(id) ?? null
    }

    async deleteSession(id: string): Promise<void> {
        this.sessions.delete(id)
    }
}
