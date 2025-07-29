# Scope Module

The `#scope` module provides base interfaces for application-level and request-level scopes in @declaro/core.

## Recommended Import (Preferred)

Use the `#scope` subpath import for the cleanest experience:

```typescript
import type { AppScope, RequestScope } from '#scope'

// Use the base interfaces directly
function doSomething(appScope: AppScope, requestScope: RequestScope) {
    // Your logic here
}
```

## Legacy Import (Deprecated)

⚠️ **Deprecated**: Importing from the main package is deprecated and will show deprecation warnings:

```typescript
// ❌ Deprecated - will show TypeScript warnings
import { AppScope, RequestScope } from '@declaro/core'

// ✅ Migrate to this instead:
import { AppScope, RequestScope } from '#scope'
```

The deprecation warnings include migration instructions to help you update your code.

## Extending Scope Interfaces

Users can augment the scope interfaces by creating a declaration file in their project:

```typescript
// types/scope.d.ts or any .d.ts file in your project
declare module '#scope' {
    interface AppScope {
        // Add your app-level scope properties
        config: MyAppConfig
        database: DatabaseConnection
        logger: Logger
    }

    interface RequestScope {
        // Add your request-level scope properties
        user: User
        session: Session
        locale: string
    }
}
```

Using `#scope` is the recommended approach as it provides cleaner separation and better module augmentation capabilities.

## Benefits of This Approach

1. **Type Safety**: Full TypeScript support with proper type resolution
2. **Module Augmentation**: Users can extend interfaces using declaration merging
3. **Cross-Platform**: Works in both ESM and CommonJS environments
4. **Build Tool Support**: Bundlers can correctly resolve the import
5. **Runtime Availability**: The module exists at runtime, not just for types
