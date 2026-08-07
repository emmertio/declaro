import { ModelSchema } from '@declaro/core'
import { privateField, sortArray, ZodModel } from '@declaro/zod'
import { z } from 'zod/v4'
import type {
    InferDetail,
    InferFilters,
    InferInput,
    InferLookup,
    InferSummary,
} from '../../../shared/utils/schema-inference'

/**
 * A schema whose private fields differ per model, so tests can prove that each operation
 * serialized with the right one.
 *
 * - `passwordHash` is private on the detail model: readable by the service, never sent out.
 * - `email` is private on the summary model but public on the detail model.
 * - `slug` is private on the input model: a computed value the service owns and clients cannot set.
 */
export const MockUserSchema = ModelSchema.create('User')
    .read({
        detail: (h) =>
            new ZodModel(
                h.name,
                z.object({
                    id: z.number().int().positive(),
                    name: z.string().min(2).max(100),
                    email: z.string(),
                    slug: z.string(),
                    passwordHash: privateField(z.string()),
                }),
            ),
        lookup: (h) =>
            new ZodModel(
                h.name,
                z.object({
                    id: z.number().int().positive(),
                }),
            ),
    })
    .search({
        filters: (h) =>
            new ZodModel(
                h.name,
                z.object({
                    text: z.string().optional(),
                }),
            ),
        summary: (h) =>
            new ZodModel(
                h.name,
                z.object({
                    id: z.number().int().positive(),
                    name: z.string().min(2).max(100),
                    email: privateField(z.string()),
                }),
            ),
        sort: (h) => new ZodModel(h.name, sortArray(['name'])),
    })
    .write({
        input: (h) =>
            new ZodModel(
                h.name,
                z.object({
                    id: z.number().int().positive().optional(),
                    name: z.string().min(2).max(100),
                    email: z.string(),
                    passwordHash: z.string(),
                    slug: privateField(z.string()),
                }),
            ),
    })
    .entity({
        primaryKey: 'id',
    })

/** A complete user record, including the fields that never reach a client. */
export type MockUserDetail = InferDetail<typeof MockUserSchema>
/** A user record as it appears in a list. */
export type MockUserSummary = InferSummary<typeof MockUserSchema>
/** The criteria used to find a single user. */
export type MockUserLookup = InferLookup<typeof MockUserSchema>
/** The criteria used to search for users. */
export type MockUserFilters = InferFilters<typeof MockUserSchema>
/** A writable user payload. */
export type MockUserInput = InferInput<typeof MockUserSchema>

/**
 * Builds a complete user record, including the fields that must never reach a client.
 * @param overrides Values to change on the generated record.
 * @returns A user record.
 */
export function buildMockUser(overrides: Partial<MockUserDetail> = {}): MockUserDetail {
    return {
        id: 1,
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        slug: 'ada-lovelace',
        passwordHash: 'hashed-secret',
        ...overrides,
    } as MockUserDetail
}
