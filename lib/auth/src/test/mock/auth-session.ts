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
        id: mockAuthPayload.sid,
        jwt: mockJwt,
        jwtPayload: mockAuthPayload,
        expires: new Date(mockAuthPayload.exp),
        issued: new Date(mockAuthPayload.iat),
        roles: ['role1', 'role2'],
        claims: ['claim1', 'claim2'],
        memberships: [
            {
                id: 'f46fa42e-18e1-4fce-b809-7492c44700ae',
                team: {
                    id: '752fe6a0-829f-4c5a-b90f-491bed13d333',
                    name: 'Team One',
                },
                claims: ['team-claim-1', 'team-claim-2'],
                roles: ['team-role-1', 'team-role-2'],
            },
            {
                id: '3d3e7d31-8cad-486e-ad59-0cf859d635d7',
                team: {
                    id: '801769e1-bc6e-4993-902e-645c455597f6',
                    name: 'Team Two',
                },
                claims: ['team-claim-3', 'team-claim-4'],
                roles: ['team-role-3', 'team-role-4'],
            },
        ],
    }
    return {
        ...mockAuthSession,
        ...overrides,
    }
}
