import { ModelSchema, type InferModelOutput } from '@declaro/core'
import { ZodModel } from '@declaro/zod'
import { z } from 'zod/v4'

export enum AuthSubject {
    ACCESS = 'ACCESS',
    CONFIRM = 'CONFIRM',
    INVITE = 'INVITE',
    RECOVER = 'RECOVER',
    REFRESH = 'REFRESH',
}

export const AuthPayloadModel = new ZodModel(
    'AuthPayload' as const,
    z.object({
        /**
         * Unique session ID, can be generated or provided
         */
        sid: z.string(),
        /**
         * Unique user ID
         */
        id: z.string(),
        email: z.email(),
        nickname: z.string(),
        given_name: z.string().optional(),
        family_name: z.string().optional(),
        name: z.string(),
        /**
         * Issued at time in seconds since epoch
         */
        iat: z.number(),
        /**
         * Expiration time in seconds since epoch
         */
        exp: z.number(),
        sub: z.enum(AuthSubject),
    }),
)
export type IAuthPayload = InferModelOutput<typeof AuthPayloadModel>

const AuthTeamSummarySchema = new ZodModel(
    'AuthTeamSummary',
    z.object({
        id: z.string(),
        name: z.string(),
    }),
)

export type IAuthTeamSummary = InferModelOutput<typeof AuthTeamSummarySchema>

const AuthMembershipSummaryModel = new ZodModel(
    'AuthMembershipSummary',
    z.object({
        claims: z.array(z.string()).optional(),
        roles: z.array(z.string()).optional(),
        team: AuthTeamSummarySchema.schema,
    }),
)

export type IAuthMembershipSummary = InferModelOutput<typeof AuthMembershipSummaryModel>

const AuthSessionInputModel = new ZodModel(
    'AuthSessionInput' as const,
    z.object({
        /**
         * Unique session ID, can be generated or provided
         */
        id: z.string().optional(),
        jwt: z.jwt(),
        claims: z.array(z.string()).optional(),
        roles: z.array(z.string()).optional(),
        memberships: z.array(AuthMembershipSummaryModel.schema).optional(),
    }),
)
export type IAuthSessionInput = InferModelOutput<typeof AuthSessionInputModel>

export const AuthSessionModel = new ZodModel(
    'AuthSession' as const,
    z.object({
        /**
         * Unique session ID, can be generated or provided
         */
        id: z.string(),
        jwt: z.jwt(),
        jwtPayload: AuthPayloadModel.schema,
        expires: z.date(),
        issued: z.date(),
        roles: z.array(z.string()),
        claims: z.array(z.string()),
        memberships: z.array(AuthMembershipSummaryModel.schema),
    }),
)
export type IAuthSession = InferModelOutput<typeof AuthSessionModel>

export const AuthSessionSchema = ModelSchema.create('AuthSession' as const).custom({
    authPayload: () => AuthPayloadModel,
    authSessionInput: () => AuthSessionInputModel,
    authSession: () => AuthSessionModel,
    authMembership: () => AuthMembershipSummaryModel,
    authTeamSummary: () => AuthTeamSummarySchema,
})
