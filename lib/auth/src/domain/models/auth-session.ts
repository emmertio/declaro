export enum AuthSubject {
    ACCESS = 'ACCESS',
    CONFIRM = 'CONFIRM',
    INVITE = 'INVITE',
    RECOVER = 'RECOVER',
    REFRESH = 'REFRESH',
}

export interface IAuthPayload {
    id: string
    email: string
    nickname: string
    given_name?: string
    family_name?: string
    name: string
    iat: number
    exp: number
    sub: AuthSubject
}

export interface IAuthSession {
    id: string
    jwt: string
    jwtPayload: IAuthPayload
    expires: Date
    issued: Date
    roles: string[]
    claims: string[]
}

export interface IAuthSessionInput {
    id?: string
    jwt: string
    claims?: string[]
    roles?: string[]
}
