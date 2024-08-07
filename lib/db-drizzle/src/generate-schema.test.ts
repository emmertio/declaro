import { describe, expect, it } from "vitest";
import { pgTable, varchar, integer } from 'drizzle-orm/pg-core'
import { generateSchema } from "./generate-schema";

describe('Generate Schema', () => {
    const table = pgTable('table', {
        foo: varchar('foo'),
        bar: integer('bar')
    })

    it('should generate input and select types for a pgTable', () => {
        const schema = generateSchema(table)

        expect(schema.select._def.openapi.metadata.title).toBe('Table')
        expect(schema.insert._def.openapi.metadata.title).toBe('Table Input')

        expect(schema.insert.shape.foo._def.openapi.metadata.title).toBe('Foo')
        expect(schema.select.shape.foo._def.openapi.metadata.title).toBe('Foo')
        expect(schema.insert.shape.bar._def.openapi.metadata.title).toBe('Bar')
        expect(schema.select.shape.bar._def.openapi.metadata.title).toBe('Bar')
    })
})