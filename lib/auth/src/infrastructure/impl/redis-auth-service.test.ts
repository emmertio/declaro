import Redis from 'ioredis-mock'
import { beforeAll, describe, it, expect } from 'bun:test'
import { RedisAuthService } from './redis-auth-service'
import { mockAuthConfig } from '../../test/mock/auth-config'
import { mockJwt } from '../../test/mock/auth-session'

describe('RedisAuthService', () => {
    let redisAuthService: RedisAuthService

    beforeAll(() => {
        const redis = new Redis()

        redisAuthService = new RedisAuthService(mockAuthConfig, redis)
    })

    it('should save a session', async () => {
        const session = await redisAuthService.createSession({
            jwt: mockJwt,
            claims: ['claim1', 'claim2'],
            roles: ['role1', 'role2'],
        })

        expect(session).toBeDefined()
        expect(session.id).toBeDefined()
        expect(session.jwt).toBe(mockJwt)
        expect(session.claims).toEqual(['claim1', 'claim2'])
        expect(session.roles).toEqual(['role1', 'role2'])
        expect(session.jwtPayload).toBeDefined()
        expect(session.jwtPayload.id).toBeDefined()
        expect(session.jwtPayload.email).toBe('test@emmert.io')
        expect(session.jwtPayload.nickname).toBe('Test User')
        expect(session.jwtPayload.given_name).toBe('Test')
        expect(session.jwtPayload.family_name).toBe('User')
        expect(session.jwtPayload.name).toBe('Test User')
        expect(session.expires).toBeInstanceOf(Date)
        expect(session.issued).toBeInstanceOf(Date)
    })

    it('should retrieve a session by ID', async () => {
        const sessionId = redisAuthService.getSessionId()
        await redisAuthService.createSession({
            id: sessionId,
            jwt: mockJwt,
            claims: ['claim1', 'claim2'],
            roles: ['role1', 'role2'],
        })

        const session = await redisAuthService.getSession(sessionId)
        expect(session).toBeDefined()
        expect(session?.id).toBe(sessionId)
        expect(session?.jwt).toBe(mockJwt)
        expect(session?.claims).toEqual(['claim1', 'claim2'])
        expect(session?.roles).toEqual(['role1', 'role2'])
        expect(session?.jwtPayload).toBeDefined()
        expect(session?.jwtPayload.id).toBeDefined()
        expect(session?.jwtPayload.email).toBe('test@emmert.io')
        expect(session?.jwtPayload.nickname).toBe('Test User')
        expect(session?.jwtPayload.given_name).toBe('Test')
        expect(session?.jwtPayload.family_name).toBe('User')
        expect(session?.jwtPayload.name).toBe('Test User')
    })
})
