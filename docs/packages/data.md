# @declaro/data

The data layer for Declaro. Provides `ModelService` for event-driven CRUD operations, the `IRepository` interface for data access, `ModelController` for auth-protected endpoints, and type inference utilities that flow from your schema definitions.

## Installation

```bash
bun add @declaro/data
# or
npm install @declaro/data
```

**Peer dependencies:** `@declaro/core`

## Table of Contents

- [Overview](#overview)
- [ModelService](#modelservice)
- [ReadOnlyModelService](#readonlymodelservice)
- [IRepository Interface](#irepository-interface)
- [Controllers](#controllers)
- [Domain Events](#domain-events)
- [Type Inference](#type-inference)
- [Pagination](#pagination)
- [Schema Inheritance](#schema-inheritance)
- [Extending Services](#extending-services)

---

## Overview

The data layer sits between your application code and your data store:

```
Controller  →  Service  →  Repository  →  Database
   (auth)      (events)     (data access)
```

- **ModelService** wraps a repository with event emission and normalization hooks
- **IRepository** is a storage-agnostic interface you implement for your database
- **ModelController** adds permission checks on top of a service

All types are inferred from your `ModelSchema` — define your schema once, and the service, repository, and controller all know the correct input/output shapes.

---

## ModelService

The full CRUD service. Extends `ReadOnlyModelService` with create, update, remove, restore, upsert, duplicate, and permanent delete operations.

### Setup

```typescript
import { ModelService } from '@declaro/data'
import { EventManager } from '@declaro/core'

const events = new EventManager()

const bookService = new ModelService({
    schema: BookSchema,           // your ModelSchema
    repository: bookRepository,   // your IRepository implementation
    emitter: events,              // EventManager for before/after events
    namespace: 'library',         // optional, defaults to 'global'
})
```

### CRUD Operations

```typescript
// Create
const book = await bookService.create({
    title: 'Dune',
    author: 'Frank Herbert',
})

// Read
const loaded = await bookService.load({ id: book.id })
const many = await bookService.loadMany([{ id: '1' }, { id: '2' }])

// Update
const updated = await bookService.update(
    { id: book.id },
    { title: 'Dune (Revised)' },
)

// Search with pagination and sorting
const results = await bookService.search(
    { author: 'Frank Herbert' },
    {
        pagination: { page: 1, pageSize: 25 },
        sort: { title: 'asc' },
    },
)

// Count
const total = await bookService.count({ author: 'Frank Herbert' })
```

### Upsert

Creates a new record or updates an existing one, based on the primary key:

```typescript
// No primary key → creates
await bookService.upsert({ title: 'New Book', author: 'Author' })

// Has primary key that exists → updates
await bookService.upsert({ id: 'abc-123', title: 'Updated Title', author: 'Author' })

// Bulk upsert — efficiently batches lookups
await bookService.bulkUpsert([
    { id: 'abc-123', title: 'Updated', author: 'Author A' },
    { title: 'Brand New', author: 'Author B' },
])
```

### Soft Delete and Restore

```typescript
// Soft delete (moves to trash)
const removed = await bookService.remove({ id: 'abc-123' })

// Restore from trash
const restored = await bookService.restore({ id: 'abc-123' })

// Search only trashed items
const trashed = await bookService.search({}, { removedOnly: true })

// Search including trashed items
const all = await bookService.search({}, { includeRemoved: true })
```

### Permanent Delete

```typescript
// Permanently delete from trash
await bookService.permanentlyDeleteFromTrash({ id: 'abc-123' })

// Permanently delete (active or trashed)
await bookService.permanentlyDelete({ id: 'abc-123' })

// Empty all trash, optionally filtered
const deletedCount = await bookService.emptyTrash()
const deletedCount = await bookService.emptyTrash({ author: 'Unknown' })
```

### Duplicate

Loads an existing record, converts it to input format, strips the primary key, and creates a new copy:

```typescript
// Simple duplicate
const copy = await bookService.duplicate({ id: 'abc-123' })

// Duplicate with overrides
const copy = await bookService.duplicate(
    { id: 'abc-123' },
    { title: 'Copy of Dune' },
)
```

### Listening to Events

Every operation emits before/after events through the `EventManager`:

```typescript
const events = new EventManager()
const bookService = new ModelService({
    schema: BookSchema,
    repository: bookRepository,
    emitter: events,
    namespace: 'library',
})

// Event type format: "namespace::resource.action"
events.on('library::book.beforeCreate', (event) => {
    console.log('About to create:', event.input)
})

events.on('library::book.afterCreate', (event) => {
    console.log('Created:', event.data)         // the result
    console.log('From input:', event.input)     // the original input
    console.log('Meta:', event.meta.args)       // { input, options }
})

events.on('library::book.afterUpdate', (event) => {
    console.log('Updated:', event.data)
    console.log('Previous:', event.meta.existing)  // the record before update
})
```

### Silencing Events

Pass `doNotDispatchEvents: true` to skip event emission:

```typescript
await bookService.create(input, { doNotDispatchEvents: true })
await bookService.update(lookup, input, { doNotDispatchEvents: true })
```

---

## ReadOnlyModelService

A service with only read operations: `load`, `loadMany`, `search`, and `count`. Use this when you have entities that shouldn't be mutated through the service layer (e.g., read replicas, views, computed data).

```typescript
import { ReadOnlyModelService } from '@declaro/data'

const productCatalog = new ReadOnlyModelService({
    schema: ProductSchema,
    repository: productRepository,
    emitter: events,
})

const product = await productCatalog.load({ id: '123' })
const results = await productCatalog.search({ category: 'electronics' })
```

### Query Events

| Event | When |
|---|---|
| `beforeLoad` | Before loading a single record |
| `afterLoad` | After loading a single record |
| `beforeLoadMany` | Before batch loading records |
| `afterLoadMany` | After batch loading records |
| `beforeSearch` | Before executing a search |
| `afterSearch` | After executing a search |
| `beforeCount` | Before counting records |
| `afterCount` | After counting records |

---

## IRepository Interface

The repository interface defines the data access contract. Implement this for your storage backend (PostgreSQL, MongoDB, in-memory, etc.).

```typescript
import type { IRepository } from '@declaro/data'

class PostgresBookRepository implements IRepository<typeof BookSchema> {
    async load(lookup, options?) {
        // SELECT * FROM books WHERE id = lookup.id
        // Handle options.removedOnly, options.includeRemoved
    }

    async loadMany(lookups, options?) {
        // SELECT * FROM books WHERE id IN (...)
    }

    async search(filters, options?) {
        // SELECT ... FROM books WHERE ... 
        // Apply filters, options.pagination, options.sort
        // Return { results: [...], pagination: { page, pageSize, total, totalPages } }
    }

    async create(input, options?) {
        // INSERT INTO books ...
    }

    async update(lookup, input, options?) {
        // UPDATE books SET ... WHERE id = lookup.id
    }

    async remove(lookup, options?) {
        // UPDATE books SET deleted_at = NOW() WHERE id = lookup.id
        // (or your soft-delete strategy)
    }

    async restore(lookup, options?) {
        // UPDATE books SET deleted_at = NULL WHERE id = lookup.id
    }

    async upsert(input, options?) {
        // INSERT ... ON CONFLICT DO UPDATE
    }

    async bulkUpsert(inputs, options?) {
        // Batch INSERT ... ON CONFLICT DO UPDATE
    }

    async count(filters, options?) {
        // SELECT COUNT(*) FROM books WHERE ...
    }

    async emptyTrash(filters?) {
        // DELETE FROM books WHERE deleted_at IS NOT NULL AND ...
    }

    async permanentlyDeleteFromTrash(lookup) {
        // DELETE FROM books WHERE id = ... AND deleted_at IS NOT NULL
    }

    async permanentlyDelete(lookup) {
        // DELETE FROM books WHERE id = ...
    }
}
```

### Full Method Signatures

| Method | Input | Output | Description |
|---|---|---|---|
| `load` | `InferLookup<Schema>` | `InferDetail<Schema> \| null` | Load one record |
| `loadMany` | `InferLookup<Schema>[]` | `InferDetail<Schema>[]` | Load multiple records |
| `search` | `InferFilters<Schema>` | `ISearchResults<InferSummary<Schema>>` | Search with pagination |
| `create` | `InferInput<Schema>` | `InferDetail<Schema>` | Create a record |
| `update` | `InferLookup, InferInput` | `InferDetail<Schema>` | Update a record |
| `remove` | `InferLookup<Schema>` | `InferSummary<Schema>` | Soft delete |
| `restore` | `InferLookup<Schema>` | `InferSummary<Schema>` | Restore from trash |
| `upsert` | `InferInput<Schema>` | `InferDetail<Schema>` | Create or update |
| `bulkUpsert` | `InferInput<Schema>[]` | `InferDetail<Schema>[]` | Batch create or update |
| `count` | `InferFilters<Schema>` | `number` | Count matching records |
| `emptyTrash` | `InferFilters<Schema>?` | `number` | Permanent delete from trash |
| `permanentlyDeleteFromTrash` | `InferLookup<Schema>` | `InferSummary<Schema>` | Permanent delete one from trash |
| `permanentlyDelete` | `InferLookup<Schema>` | `InferSummary<Schema>` | Permanent delete (any) |

### MockMemoryRepository

For testing, the package provides an in-memory repository:

```typescript
import { MockMemoryRepository, MockBookSchema } from '@declaro/data'

const repository = new MockMemoryRepository({ schema: MockBookSchema })
```

---

## Controllers

Controllers add permission-based authorization on top of services. Each operation has a corresponding `*Permissions` method you can override to customize access control.

### ModelController

```typescript
import { ModelController } from '@declaro/data'

const bookController = new ModelController(bookService, authValidator)

// Each method checks permissions before delegating to the service
const book = await bookController.create(input)     // checks create or write
const updated = await bookController.update(lookup, input) // checks update or write
const removed = await bookController.remove(lookup)  // checks remove or write
```

### ReadOnlyModelController

```typescript
import { ReadOnlyModelController } from '@declaro/data'

const catalogController = new ReadOnlyModelController(productService, authValidator)

const product = await catalogController.load({ id: '123' })     // checks load or read
const results = await catalogController.search({ category: 'books' }) // checks search or read
```

### Default Permission Logic

Controllers generate permission strings from the service's `ActionDescriptor`:

```typescript
// For a book service in the 'library' namespace:
// create → someOf(['library::book.create:*', 'library::book.write:*'])
// update → someOf(['library::book.update:*', 'library::book.write:*'])
// remove → someOf(['library::book.remove:*', 'library::book.write:*'])
// load   → someOf(['library::book.load:*',   'library::book.read:*'])
// search → someOf(['library::book.search:*', 'library::book.read:*'])
```

### Customizing Permissions

Override the permission methods to implement custom access control:

```typescript
class BookController extends ModelController<typeof BookSchema> {
    async createPermissions(input) {
        // Only admins can create books
        return PermissionValidator.create().allOf(['admin'])
    }

    async updatePermissions(lookup, input) {
        // Authors can update their own books
        return PermissionValidator.create().someOf([
            'admin',
            `book:${lookup.id}:owner`,
        ])
    }
}
```

---

## Domain Events

The event system uses a hierarchy of typed events.

### Event Hierarchy

```
DomainEvent          — base event with ID, timestamp, descriptor, session
  └─ RequestEvent    — adds input and result
      ├─ QueryEvent      — for read operations (load, search, count)
      └─ MutationEvent   — for write operations (create, update, remove, etc.)
```

### DomainEvent

Base event with metadata:

```typescript
interface IDomainEvent<T, M> {
    eventId: string              // UUID
    type: string                 // e.g., "library::book.afterCreate"
    data?: T                     // operation result
    meta?: M                     // additional metadata
    timestamp: Date
    descriptor: IActionDescriptor // { namespace, resource, action, scope }
    session?: IAuthSession       // user session (if available)
}
```

### MutationEvent Metadata

Mutation events carry metadata about the operation:

```typescript
// afterCreate event
event.input                     // the input data
event.data                      // the created record (result)
event.meta.args.input           // original input
event.meta.args.options         // options passed to create()

// afterUpdate event
event.input                     // the input data
event.data                      // the updated record (result)
event.meta.existing             // the record BEFORE the update
event.meta.args.lookup          // the lookup used
event.meta.args.input           // original input

// afterRemove event
event.input                     // the lookup
event.data                      // the removed record summary
event.meta.args.lookup          // the lookup used

// afterDuplicate event
event.input                     // the final input (after conversion + overrides)
event.data                      // the new duplicate record
event.meta.existing             // the source record
event.meta.args.lookup          // original lookup
event.meta.args.overrides       // overrides passed to duplicate()
```

### Full Event List

**Query Events:**

| Event | Emitted By | Payload |
|---|---|---|
| `beforeLoad` / `afterLoad` | `load()` | lookup → detail |
| `beforeLoadMany` / `afterLoadMany` | `loadMany()` | lookups → details |
| `beforeSearch` / `afterSearch` | `search()` | filters → search results |
| `beforeCount` / `afterCount` | `count()` | filters → number |

**Mutation Events:**

| Event | Emitted By | Payload |
|---|---|---|
| `beforeCreate` / `afterCreate` | `create()`, `upsert()` | input → detail |
| `beforeUpdate` / `afterUpdate` | `update()`, `upsert()` | input → detail |
| `beforeRemove` / `afterRemove` | `remove()` | lookup → summary |
| `beforeRestore` / `afterRestore` | `restore()` | lookup → summary |
| `beforeDuplicate` / `afterDuplicate` | `duplicate()` | input → detail |
| `beforeEmptyTrash` / `afterEmptyTrash` | `emptyTrash()` | filters → count |
| `beforePermanentlyDeleteFromTrash` / `afterPermanentlyDeleteFromTrash` | `permanentlyDeleteFromTrash()` | lookup → summary |
| `beforePermanentlyDelete` / `afterPermanentlyDelete` | `permanentlyDelete()` | lookup → summary |

### Event Serialization

All domain events support JSON serialization for logging, queuing, and replay:

```typescript
events.on('library::book.afterCreate', (event) => {
    const json = event.toJSON()
    // {
    //   eventId: "uuid",
    //   type: "library::book.afterCreate",
    //   timestamp: "2025-01-15T...",
    //   data: { id: "...", title: "..." },
    //   input: { title: "...", author: "..." },
    //   meta: { args: { input: {...}, options: {...} } },
    //   session: { id: "session-uuid" }
    // }
    await eventQueue.push(json)
})
```

---

## Type Inference

All types flow from your `ModelSchema` definition. Import inference helpers from `@declaro/data`:

```typescript
import type {
    InferDetail,         // Output type of the detail model
    InferLookup,         // Input type of the lookup model
    InferInput,          // Input type of the input (write) model
    InferSummary,        // Output type of the summary model
    InferFilters,        // Input type of the filters model
    InferSort,           // Input type of the sort model
    InferSearchResults,  // { results: InferSummary<S>[], pagination: IPagination }
    InferEntityMetadata, // Entity metadata (e.g., { primaryKey: 'id' })
    InferPrimaryKeyType, // Type of the primary key value
} from '@declaro/data'

// Usage
type BookDetail = InferDetail<typeof BookSchema>
// { id: string; title: string; author: string; publishedAt: Date }

type BookLookup = InferLookup<typeof BookSchema>
// { id: string }

type BookInput = InferInput<typeof BookSchema>
// { title: string; author: string; publishedAt: Date }

type BookFilters = InferFilters<typeof BookSchema>
// { title?: string; author?: string }
```

### Schema-Level Type Inference

Access the underlying Zod schemas:

```typescript
import type {
    InferDetailSchema,
    InferLookupSchema,
    InferInputSchema,
    InferFiltersSchema,
    InferSortSchema,
    InferSummarySchema,
} from '@declaro/data'

type BookDetailZod = InferDetailSchema<typeof BookSchema>
// The raw Zod schema type
```

---

## Pagination

Pagination is built into search operations:

```typescript
const results = await bookService.search(
    { author: 'Herbert' },
    {
        pagination: {
            page: 2,       // 1-based, defaults to 1
            pageSize: 10,  // defaults to 25
        },
    },
)

results.results     // InferSummary<Schema>[]
results.pagination  // { page: 2, pageSize: 10, total: 47, totalPages: 5 }
```

### Pagination Types

```typescript
interface IPaginationInput {
    page?: number | null      // 1-based, default 1
    pageSize?: number | null  // default 25
}

interface IPagination {
    page: number              // current page
    pageSize: number          // items per page
    total: number             // total matching items
    totalPages: number        // calculated total pages
}

interface ISearchResults<T> {
    results: T[]
    pagination: IPagination
}
```

---

## Schema Inheritance

Create child schemas that inherit the shape of a parent:

```typescript
import type { ChildSchema } from '@declaro/data'

// A child schema preserves the parent's model shapes and entity metadata
type AnimalChildSchema = ChildSchema<typeof AnimalSchema>

// Useful for creating specialized repositories that share the same data contract
class ElephantService extends ModelService<ChildSchema<typeof AnimalSchema>> {
    // Inherits the same load/search/create types as AnimalService
}
```

---

## Extending Services

Override normalization methods to customize service behavior:

### Custom Input Normalization

```typescript
class BookService extends ModelService<typeof BookSchema> {
    protected async normalizeInput(input, args) {
        return {
            ...input,
            title: input.title.trim(),
            // Access the existing record during updates
            updatedAt: args.existing ? new Date() : undefined,
        }
    }
}
```

### Custom Detail Normalization

```typescript
class BookService extends ReadOnlyModelService<typeof BookSchema> {
    async normalizeDetail(detail) {
        return {
            ...detail,
            // Compute derived fields
            displayTitle: `${detail.title} by ${detail.author}`,
        }
    }

    async normalizeSummary(summary) {
        return {
            ...summary,
            titleSlug: summary.title.toLowerCase().replace(/\s+/g, '-'),
        }
    }
}
```

### Custom Lookup Normalization

Useful for injecting tenant context or remapping IDs:

```typescript
class TenantBookService extends ModelService<typeof BookSchema> {
    protected async normalizeLookup(lookup) {
        return {
            ...lookup,
            tenantId: this.currentTenantId,
        }
    }
}
```

### Custom Sort Defaults

```typescript
class BookService extends ReadOnlyModelService<typeof BookSchema> {
    protected async normalizeSort(sort) {
        // Default to sorting by creation date if no sort specified
        return sort ?? { createdAt: 'desc' }
    }
}
```
