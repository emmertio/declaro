import { describe, expect, it } from 'vitest'
import type { JSONSchema } from '../../schema/json-schema'
import { stripPrivateFieldsFromSchema } from './schema-utils'

describe('Schema Utils', () => {
    it('should strip private fields from schema', () => {
        const schema: JSONSchema = {
            type: 'object',
            properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                secret: { type: 'string', private: true },
                internalNote: { type: 'string', hidden: true },
            },
        }

        const stripped = stripPrivateFieldsFromSchema(schema)

        // The return value should have the private field removed
        expect(stripped.properties).toBeDefined()
        expect(stripped.properties?.['id']).toBeDefined()
        expect(stripped.properties?.['name']).toBeDefined()
        expect(stripped.properties?.['secret']).toBeUndefined()
        expect(stripped.properties?.['internalNote']).toBeDefined()

        // The original schema should also have the private field removed
        expect(schema.properties).toBeDefined()
        expect(schema.properties?.['id']).toBeDefined()
        expect(schema.properties?.['name']).toBeDefined()
        expect(schema.properties?.['secret']).toBeUndefined()
        expect(schema.properties?.['internalNote']).toBeDefined()
    })
})
