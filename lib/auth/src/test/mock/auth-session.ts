import type { IAuthPayload, IAuthSession } from '../../domain/models/auth-session'
import jwt from 'jsonwebtoken'

export const mockJwt =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjIwZGUzOTg3LTM1N2ItNDgzOC1iMjFmLTE1OWIyMGNjNzNmOCIsImVtYWlsIjoidGVzdEBlbW1lcnQuaW8iLCJuaWNrbmFtZSI6IlRlc3QgVXNlciIsImdpdmVuX25hbWUiOiJUZXN0IiwiZmFtaWx5X25hbWUiOiJVc2VyIiwibmFtZSI6IlRlc3QgVXNlciIsImlhdCI6MCwiZXhwIjowLCJzdWIiOiJhY2Nlc3MifQ.xbrw67jYXyIHJxcDI0tVwQJKEJgFOE7jwd34nUNn9NI'

export const mockAuthPayload: IAuthPayload = jwt.decode(mockJwt) as IAuthPayload

export const mockAuthSession: IAuthSession = {
    id: mockAuthPayload.id,
    jwt: mockJwt,
    jwtPayload: mockAuthPayload,
    expires: new Date(mockAuthPayload.exp * 1000),
    issued: new Date(mockAuthPayload.iat * 1000),
    roles: ['role1', 'role2'],
    claims: ['claim1', 'claim2'],
}
