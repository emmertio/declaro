# @declaro/zod

Zod integration for Declaro. Provides `ZodModel` — a concrete implementation of the abstract `Model` class from `@declaro/core` that uses [Zod](https://zod.dev/) for validation and JSON Schema generation.

## Installation

```bash
bun add @declaro/zod
# or
npm install @declaro/zod
```

**Peer dependencies:** `@declaro/core`, `zod`

## Table of Contents

- [ZodModel](#zodmodel)
- [Creating Models](#creating-models)
- [Validation](#validation)
- [JSON Schema Generation](#json-schema-generation)
- [Field Utilities](#field-utilities)
- [Sort Utilities](#sort-utilities)
- [Using with ModelSchema](#using-with-modelschema)

---

## ZodModel

`ZodModel` extends the abstract `Model` from `@declaro/core`, binding Zod schemas to Declaro's model system. It provides:

- Validation via [StandardSchemaV1](https://github.com/standard-schema/standard-schema)
- JSON Schema generation from Zod schemas
- Automatic label generation from model names
- Private field stripping for API output

```typescript
import { ZodModel } from '@declaro/zod'
import { z } from 'zod/v4'

const UserModel = new ZodModel('User', z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
    createdAt: z.date(),
}))
```

---

## Creating Models

### Basic Model

```typescript
const ProductModel = new ZodModel('Product', z.object({
    id: z.number().int(),
    name: z.string().min(1).max(255),
    price: z.number().positive(),
    description: z.string().optional(),
}))

// Access model properties
ProductModel.name    // "Product"
ProductModel.schema  // the Zod schema
ProductModel.labels  // auto-generated labels
ProductModel.version // schema version number
```

### Model with Metadata

Use Zod's `.meta()` to attach custom field labels:

```typescript
const PersonModel = new ZodModel('Person', z.object({
    givenName: z.string().meta({ label: 'First Name' }),
    familyName: z.string().meta({ label: 'Last Name' }),
    birthYear: z.number().int().meta({ label: 'Year of Birth' }),
}))
```

---

## Validation

ZodModel validates through the StandardSchemaV1 interface:

### Strict Validation (Default)

Throws a `ValidationError` on failure:

```typescript
try {
    const result = await UserModel.validate({
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Alice',
        email: 'alice@example.com',
        createdAt: new Date(),
    })
    console.log(result.value) // validated data
} catch (error) {
    // ValidationError with code 400
    console.log(error.meta.result.issues)
}
```

### Non-Strict Validation

Returns a result object instead of throwing:

```typescript
const result = await UserModel.validate(
    { name: '', email: 'not-an-email' },
    { strict: false },
)

if ('issues' in result) {
    console.log(result.issues) // validation errors
} else {
    console.log(result.value)  // validated data
}
```

### StandardSchemaV1 Interface

Models are directly compatible with any library that accepts StandardSchemaV1:

```typescript
// The ~standard property exposes the standard interface
UserModel['~standard']
// { version: 1, vendor: 'zod', validate: (input) => ... }
```

---

## JSON Schema Generation

Generate JSON Schema from your Zod models:

```typescript
const schema = UserModel.toJSONSchema()
// {
//   type: 'object',
//   properties: {
//     id: { type: 'string', format: 'uuid' },
//     name: { type: 'string' },
//     email: { type: 'string', format: 'email' },
//     createdAt: { type: 'string', format: 'date-time' },
//   },
//   required: ['id', 'name', 'email', 'createdAt'],
// }
```

### Date Handling

Date fields are automatically converted to `{ type: 'string', format: 'date-time' }` in JSON Schema, since JSON has no native date type.

### Private Fields

Fields marked as private are excluded from JSON Schema by default:

```typescript
import { privateField } from '@declaro/zod'

const UserModel = new ZodModel('User', z.object({
    id: z.string().uuid(),
    name: z.string(),
    passwordHash: privateField(z.string()),  // excluded from JSON Schema
}))

UserModel.toJSONSchema()
// passwordHash is NOT in the output

// Include private fields explicitly
UserModel.toJSONSchema({ includePrivateFields: true })
// passwordHash IS in the output
```

### Custom Zod-to-JSON-Schema Options

Pass options through to the underlying `zod-to-json-schema` converter:

```typescript
UserModel.toJSONSchema({
    zodOptions: {
        // Any options supported by z.toJSONSchema()
    },
})
```

### Unrepresentable Types

Types that don't have a direct JSON Schema equivalent (e.g., `bigint`, `symbol`, `Map`, `Set`, transforms) are output as `{}` (any) by default.

---

## Field Utilities

### privateField

Marks a field to be excluded from JSON Schema output. Useful for sensitive data like passwords, tokens, and internal IDs:

```typescript
import { privateField } from '@declaro/zod'

const schema = z.object({
    name: z.string(),
    apiKey: privateField(z.string()),
    internalNotes: privateField(z.string().optional()),
})
```

Private fields:
- Are validated normally
- Are stripped from JSON Schema by default
- Are stripped from model output via `model.stripExcludedFields()`

### hiddenField

Marks a field with a `hidden` metadata flag. Unlike `privateField`, hidden fields are still included in JSON Schema but carry the flag for UI rendering decisions:

```typescript
import { hiddenField } from '@declaro/zod'

const schema = z.object({
    name: z.string(),
    sortOrder: hiddenField(z.number()),  // included in schema, marked hidden
})
```

---

## Sort Utilities

Helpers for creating sort parameter schemas:

### sortParameter

Creates a Zod enum for sort directions:

```typescript
import { sortParameter } from '@declaro/zod'

const sortDir = sortParameter()
// z.enum(['asc', 'desc', 'asc_nulls_first', 'asc_nulls_last', 'desc_nulls_first', 'desc_nulls_last'])
```

### sortObject

Creates an object schema where each field is an optional sort direction:

```typescript
import { sortObject } from '@declaro/zod'

const bookSort = sortObject(['title', 'author', 'publishedAt'])
// z.object({
//   title: sortParameter().optional(),
//   author: sortParameter().optional(),
//   publishedAt: sortParameter().optional(),
// })
```

### sortArray

Creates an array of sort objects for multi-column sorting:

```typescript
import { sortArray } from '@declaro/zod'

const bookSort = sortArray(['title', 'author', 'publishedAt'])
// z.array(sortObject(['title', 'author', 'publishedAt']))
```

---

## Using with ModelSchema

`ZodModel` is the standard way to define models within a `ModelSchema`:

```typescript
import { ModelSchema } from '@declaro/core'
import { ZodModel } from '@declaro/zod'
import { sortObject, privateField } from '@declaro/zod'
import { z } from 'zod/v4'

const OrderSchema = ModelSchema.create('Order')
    .read({
        detail: (h) => new ZodModel(h.name, z.object({
            id: z.string().uuid(),
            customerId: z.string().uuid(),
            items: z.array(z.object({
                productId: z.string(),
                quantity: z.number().int().positive(),
                price: z.number().positive(),
            })),
            total: z.number(),
            status: z.enum(['pending', 'confirmed', 'shipped', 'delivered']),
            internalNotes: privateField(z.string().optional()),
            createdAt: z.date(),
        })),
        lookup: (h) => new ZodModel(h.name, z.object({
            id: z.string().uuid(),
        })),
    })
    .search({
        summary: (h) => new ZodModel(h.name, z.object({
            id: z.string().uuid(),
            customerId: z.string().uuid(),
            total: z.number(),
            status: z.enum(['pending', 'confirmed', 'shipped', 'delivered']),
            createdAt: z.date(),
        })),
        filters: (h) => new ZodModel(h.name, z.object({
            customerId: z.string().uuid().optional(),
            status: z.enum(['pending', 'confirmed', 'shipped', 'delivered']).optional(),
            minTotal: z.number().optional(),
            maxTotal: z.number().optional(),
        })),
        sort: (h) => new ZodModel(h.name, sortObject(['total', 'createdAt', 'status'])),
    })
    .write({
        input: (h) => new ZodModel(h.name, z.object({
            customerId: z.string().uuid(),
            items: z.array(z.object({
                productId: z.string(),
                quantity: z.number().int().positive(),
                price: z.number().positive(),
            })).min(1),
        })),
    })
    .entity({ primaryKey: 'id' })
```

This schema can then be used with `ModelService` from `@declaro/data` for fully typed, event-driven CRUD operations.
