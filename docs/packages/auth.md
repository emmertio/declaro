# @declaro/auth

Authentication and authorization for Declaro. Provides JWT-based session management, role and claim validation, team-scoped permissions, and integration with Declaro's Context and Controller systems.

## Installation

```bash
bun add @declaro/auth
# or
npm install @declaro/auth
```

**Peer dependencies:** `@declaro/core`, `@declaro/zod`

## Table of Contents

- [Overview](#overview)
- [AuthService](#authservice)
- [Session Management](#session-management)
- [Auth Module (DI Integration)](#auth-module-di-integration)
- [AuthValidator](#authvalidator)
- [Permission Decorators](#permission-decorators)
- [Auth Scope Types](#auth-scope-types)
- [Testing](#testing)

---

## Overview

The auth package provides a complete authentication flow:

```
Request arrives
  → JWT extracted from Authorization header
  → JWT validated (signature + expiration)
  → Session loaded from storage (Redis)
  → Team membership resolved from x-team header
  → AuthValidator created for permission checks
  → Controller methods check permissions before executing
```

---

## AuthService

Abstract base class for session management. Handles JWT creation, validation, and decoding. Subclasses implement the storage methods.

### Configuration

```typescript
interface AuthConfig {
    authTimeout: number    // Session duration in seconds
    signingSecret?: string // JWT signing secret (falls back to APP_SECRET env var)
}
```

### Basic Usage

```typescript
import { AuthService } from '@declaro/auth'

class MyAuthService extends AuthService {
    async saveSession(session) {
        // Store session in your database/cache
        await db.sessions.insert(session)
        return session
    }

    async getSession(id) {
        // Retrieve session by ID
        return await db.sessions.findById(id)
    }

    async deleteSession(id) {
        // Remove session
        await db.sessions.deleteById(id)
    }
}

const authService = new MyAuthService({
    authTimeout: 3600,          // 1 hour
    signingSecret: 'my-secret',
})
```

### Creating Sessions

```typescript
const session = await authService.createSession({
    jwt: signedJwtToken,
    roles: ['user', 'editor'],
    claims: ['read:articles', 'write:articles'],
    memberships: [
        {
            team: { id: 'team-1', name: 'Engineering' },
            roles: ['member'],
            claims: ['deploy:staging'],
        },
    ],
})

// session.id           → "auth-session-<uuid>"
// session.jwt          → the JWT token
// session.jwtPayload   → decoded JWT payload
// session.expires      → Date (now + authTimeout)
// session.issued       → Date
// session.roles        → ['user', 'editor']
// session.claims       → ['read:articles', 'write:articles']
// session.memberships  → team memberships array
```

### JWT Operations

```typescript
// Validate JWT (checks signature + expiration, throws on failure)
const payload = authService.validateJWT(token)

// Decode JWT without verification (for debugging/inspection only)
const payload = authService.decodeJWT(token)

// payload: {
//   sid: string,        // session ID
//   id: string,         // user ID
//   email: string,
//   name: string,
//   nickname: string,
//   iat: number,        // issued at (unix timestamp)
//   exp: number,        // expiration (unix timestamp)
//   sub: AuthSubject,   // 'access' | 'confirm' | 'invite' | 'recover' | 'refresh'
// }
```

### Auth Subjects

Sessions support different JWT subject types for various auth flows:

| Subject | Use Case |
|---|---|
| `access` | Standard API access |
| `confirm` | Email confirmation |
| `invite` | User invitation |
| `recover` | Password recovery |
| `refresh` | Token refresh |

---

## Session Management

### RedisAuthService

The built-in Redis implementation stores sessions with automatic TTL:

```typescript
import { RedisAuthService } from '@declaro/auth'

const authService = new RedisAuthService(
    { authTimeout: 3600, signingSecret: 'secret' },
    redisClient,
)

// Sessions are stored in Redis with TTL = time until expiration
const session = await authService.createSession(input)

// Retrieve
const loaded = await authService.getSession(session.id)

// Delete (logout)
await authService.deleteSession(session.id)
```

### Session Model

The session model is defined using `@declaro/zod` for validation:

```typescript
interface IAuthSession {
    id: string
    jwt: string
    jwtPayload: IAuthPayload
    expires: Date
    issued: Date
    roles: string[]
    claims: string[]
    memberships: IAuthMembershipSummary[]
}

interface IAuthMembershipSummary {
    team: IAuthTeamSummary
    roles: string[]
    claims: string[]
}

interface IAuthTeamSummary {
    id: string
    name: string
}
```

---

## Auth Module (DI Integration)

Wire authentication into Declaro's Context system using the auth module:

```typescript
import { authModule } from '@declaro/auth'
import { Context, App, useDeclaro } from '@declaro/core'

const appContext = new Context()
await appContext.use(useDeclaro())
await appContext.use(authModule({
    authTimeout: 3600,
    signingSecret: process.env.JWT_SECRET,
}))
```

### What the Auth Module Registers

**App scope:**
- `authConfig` — The auth configuration
- `authService` — `RedisAuthService` instance (requires `redis` in scope)
- `authSession` — `null` (overridden per request)
- `authMembership` — `null` (overridden per request)

**Request scope (via middleware):**
- `authSession` — Loaded from Redis using the JWT's session ID
- `authMembership` — Resolved from `x-team` header against session memberships
- `authValidator` — `AuthValidator` instance with session and membership context

### Request Flow

```typescript
// Incoming request with:
//   Authorization: Bearer <jwt>
//   x-team: team-123

// 1. JWT extracted and validated
// 2. Session loaded from Redis using the decoded sid
// 3. Team membership resolved from x-team header
// 4. AuthValidator created with session + membership
// 5. If x-team header specifies a team the user is NOT a member of → ForbiddenError
```

---

## AuthValidator

Validates permissions against the current user's session, supporting both global and team-scoped claims.

### Basic Permission Checks

```typescript
import { AuthValidator } from '@declaro/auth'

// Created automatically by the auth module, or manually:
const validator = new AuthValidator(authSession, teamSummary, authService)

// Check if user has specific permissions
const hasAccess = validator.validatePermissions(
    (v) => v.someOf(['read:articles', 'admin']),
)

// Strict mode (default) — throws UnauthorizedError on failure
validator.validatePermissions(
    (v) => v.allOf(['read:articles', 'write:articles']),
    true,  // strict
)

// Non-strict mode — returns boolean
const canWrite = validator.validatePermissions(
    (v) => v.allOf(['write:articles']),
    false, // non-strict
)
```

### Team-Scoped Permissions

```typescript
// Check permissions specific to a team
validator.validateTeamPermissions(
    'team-123',
    (v) => v.someOf(['deploy:staging', 'admin']),
)
```

### Session Validation

```typescript
// Check if user has a valid session
validator.validateSession()      // throws if no valid session
validator.validateSession(false) // returns boolean

// Get the session
const session = validator.getAuthSession()
```

### Active Claims

Claims are merged from global session claims and team-specific claims:

```typescript
const claims = validator.getActiveClaims()
// Global claims: ['read:articles', 'write:articles']
// Team claims:   ['deploy:staging']
// Active claims: ['read:articles', 'write:articles', 'deploy:staging']
```

### Using with Controllers

Controllers from `@declaro/data` accept an `AuthValidator`:

```typescript
import { ModelController } from '@declaro/data'

const bookController = new ModelController(bookService, authValidator)

// Each operation checks permissions before executing
await bookController.create(input)  // requires create or write permission
await bookController.update(lookup, input) // requires update or write permission
```

---

## Permission Decorators

Use the `@ValidatePermissions` decorator for method-level permission enforcement:

```typescript
import { ValidatePermissions } from '@declaro/auth'

class ArticleService {
    authValidator: AuthValidator

    @ValidatePermissions((v) =>
        v.someOf(['write:articles', 'admin'])
    )
    async publishArticle(articleId: string) {
        // Only executes if the user has write:articles or admin permission
        return await this.repository.publish(articleId)
    }

    @ValidatePermissions((v) =>
        v.allOf(['admin'])
         .noneOf(['suspended'])
    )
    async deleteArticle(articleId: string) {
        // Requires admin AND must not be suspended
        return await this.repository.delete(articleId)
    }
}
```

**Requirements:**
- The class must have an `authValidator: AuthValidator` property
- Throws `UnauthorizedError` if validation fails

---

## Auth Scope Types

TypeScript interfaces for use with Declaro's Context system:

```typescript
interface AuthScope {
    authConfig: AuthConfig
    authService: Promise<AuthService>
    authSession: Promise<IAuthSession | null>
    authMembership: Promise<IAuthMembershipSummary | null>
}

interface AuthRequestScope extends AuthScope {
    authValidator: Promise<AuthValidator>
}
```

Use these to type your application's context:

```typescript
import type { AuthRequestScope } from '@declaro/auth'

const context = new Context<AuthRequestScope>()
const validator = await context.resolve('authValidator')
```

---

## Testing

The package provides test utilities for mocking auth:

### MockAuthService

In-memory auth service for tests:

```typescript
import { MockAuthService } from '@declaro/auth'

const mockAuth = new MockAuthService({
    authTimeout: 3600,
    signingSecret: 'test-secret',
})

// Sessions are stored in a Map
const session = await mockAuth.createSession(input)
const loaded = await mockAuth.getSession(session.id)
await mockAuth.deleteSession(session.id)
```

### Mock Session Helpers

```typescript
import {
    getMockAuthPayload,
    getMockJWT,
    getMockAuthSession,
} from '@declaro/auth'

// Create a mock JWT payload
const payload = getMockAuthPayload({
    id: 'user-123',
    email: 'test@example.com',
})

// Create a mock signed JWT
const jwt = getMockJWT({ id: 'user-123' })

// Create a complete mock session
const session = getMockAuthSession({
    roles: ['admin'],
    claims: ['*'],
})
```

### Test Context Setup

```typescript
import {
    createTestContext,
    createTestRequestContext,
} from '@declaro/auth'

// Create an app-level test context with auth module
const appContext = await createTestContext()

// Create a request-level test context with auth
const requestContext = await createTestRequestContext(
    appContext,
    new Request('http://localhost', {
        headers: { authorization: `Bearer ${mockJwt}` },
    }),
)

const validator = await requestContext.resolve('authValidator')
```
