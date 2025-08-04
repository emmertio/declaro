import { AuthSubject, type IAuthPayload, type IAuthSession } from '../../domain/models/auth-session'
import jwt from 'jsonwebtoken'

export function getMockAuthPayload(overrides: Partial<IAuthPayload> = {}): IAuthPayload {
    const mockAuthPayload: IAuthPayload = {
        id: '42',
        sid: '884ca673-6468-418d-a281-979dff45f4ea',
        email: 'test@emmert.io',
        nickname: 'Test User',
        given_name: 'Test',
        family_name: 'User',
        name: 'Test User',
        iat: new Date().getTime() / 1000, // Current time in seconds
        exp: (new Date().getTime() + 1000 * 60 * 60 * 24) / 1000, // 24 hours later
        sub: AuthSubject.ACCESS,
    }

    return {
        ...mockAuthPayload,
        ...overrides,
    }
}

export function getMockJWT(overrides: Partial<IAuthPayload> = {}): string {
    const mockAuthPayload = getMockAuthPayload(overrides)

    return jwt.sign(mockAuthPayload, 'shhhhh', {
        algorithm: 'HS256',
    })
}

export function getMockAuthSession(overrides: Partial<IAuthSession> = {}): IAuthSession {
    const mockAuthPayload = getMockAuthPayload(overrides.jwtPayload)

    const mockJwt = getMockJWT({ ...mockAuthPayload })

    const mockAuthSession: IAuthSession = {
        id: mockAuthPayload.id,
        jwt: mockJwt,
        jwtPayload: mockAuthPayload,
        expires: new Date(mockAuthPayload.exp),
        issued: new Date(mockAuthPayload.iat),
        roles: ['role1', 'role2'],
        claims: ['claim1', 'claim2'],
    }
    return {
        ...mockAuthSession,
        ...overrides,
    }
}
