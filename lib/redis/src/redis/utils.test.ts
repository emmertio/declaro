import { Model, wrapModel, type JSONSchema } from '@declaro/core'
import { describe, expect, it } from 'bun:test'
import { z } from 'zod/v4'
import { serialize, unserialize } from './utils'

/**
 * A model that reports its JSON Schema directly.
 *
 * Metadata added with Zod's `.meta()` lives in a registry belonging to the Zod instance that
 * created the schema, so a model built here cannot rely on `@declaro/core` reading it back.
 * Declaring the schema outright keeps this test about serialization rather than packaging.
 */
class StaticSchemaModel extends Model<'User', ReturnType<typeof buildUserSchema>> {
    toJSONSchema(options?: { includePrivateFields?: boolean }): JSONSchema {
        const passwordHash: JSONSchema = { type: 'string', private: true }

        return {
            type: 'object',
            properties: {
                id: { type: 'string' },
                ...(options?.includePrivateFields === true ? { passwordHash } : {}),
            },
        }
    }
}

const buildUserSchema = () => z.object({ id: z.string(), passwordHash: z.string().optional() })

const userModel = new StaticSchemaModel('User', buildUserSchema())

const buildUser = () => ({ id: 'u1', passwordHash: 'hashed-secret' })

/**
 * A record carrying a column no model declares, as a repository selecting whole rows produces.
 */
const buildUserRow = () => ({ ...buildUser(), tenantId: 'tenant-42' })

describe('serialize', () => {
    it('should keep private fields so storage holds the complete record', () => {
        const wrapped = wrapModel(userModel, buildUser())

        expect(unserialize<Record<string, unknown>>(serialize(wrapped))).toEqual(buildUser())
    })

    it('should keep private fields nested inside a stored payload', () => {
        const payload = { owner: wrapModel(userModel, buildUser()), revision: 3 }

        expect(unserialize<Record<string, unknown>>(serialize(payload))).toEqual({
            owner: buildUser(),
            revision: 3,
        })
    })

    it('should serialize plain payloads unchanged', () => {
        expect(unserialize<Record<string, unknown>>(serialize({ id: 'u1' }))).toEqual({ id: 'u1' })
    })

    it('should keep fields no model declares so storage holds the complete row', () => {
        const wrapped = wrapModel(userModel, buildUserRow())

        expect(unserialize<Record<string, unknown>>(serialize(wrapped))).toEqual(buildUserRow())
    })

    it('should leave private fields hidden when a payload is sent over a transport', () => {
        const wrapped = wrapModel(userModel, buildUser())

        // publish and enqueue call JSON.stringify directly, which is what strips private fields.
        expect(JSON.parse(JSON.stringify(wrapped))).toEqual({ id: 'u1' })
    })

    it('should leave fields no model declares out of a payload sent over a transport', () => {
        const wrapped = wrapModel(userModel, buildUserRow())

        expect(JSON.parse(JSON.stringify(wrapped))).toEqual({ id: 'u1' })
    })
})
