# Declaro Module Build System

A declaro module defines a self-contained unit of a broader application. Each module separates domain logic, infrastructure, and application concerns into distinct contexts, promoting clean architecture and separation of concerns.

Inspired by frameworks like Nuxt and Next.js, Declaro's module system leverages file-based conventions, automatic type generation, and build-time optimizations to provide a powerful yet intuitive developer experience.

## Core Concepts

### Separation of Concerns

Declaro enforces clean separation between different layers of your application:

-   **Domain**: Core business logic, entities, and domain services
-   **Application**: HTTP routes, configuration, and application-level orchestration
-   **Infrastructure**: External dependencies like databases, file systems, and third-party APIs
-   **Integrations**: Third-party service integrations with their own configuration and events
-   **Shared**: Utilities and constants accessible throughout the module

### Context-Based Dependency Injection

Each layer has its own `Context` instance that manages dependencies through a powerful dependency injection system. Contexts support:

-   **Values**: Static configuration and constants
-   **Factories**: Functions that produce values with dependency injection
-   **Classes**: Auto-instantiated classes with dependency resolution
-   **Middleware**: Functions that extend context capabilities
-   **Events**: Type-safe event emission and handling

### Type Safety Through Code Generation

The build system analyzes your module structure and generates TypeScript definitions that provide:

-   Autocomplete for all registered dependencies
-   Type-safe event emission and handling
-   Automatic import resolution
-   Compile-time validation

## Folder Structure

Declaro enforces a base layer structure to separate concerns, but you have complete flexibility in how you organize files **within** each layer. Dependencies are registered based on **exports**, not file paths within a layer.

### Required Base Structure

Your module must be divided into these top-level folders:

```
my-module/
├── application/          # Application layer (required)
├── domain/               # Domain layer (required)
├── infrastructure/       # Infrastructure layer (required)
├── integrations/         # Third-party integrations (optional)
├── shared/               # Shared utilities and constants (optional)
├── index.ts              # Module entry point
└── declaro.config.ts     # Module configuration (optional)
```

### Flexible Organization Within Layers

Within each layer, organize files however makes sense for your project. We recommend using subdirectories like `services/`, `controllers/`, `repositories/`, etc., but this is not required:

```
domain/
  services/               # Recommended but optional
    user-service.ts
    product-service.ts
  controllers/            # Recommended but optional
    user-controller.ts
  events/
    user-created.ts
  models/
    user.model.ts
  # Or flatten it:
  user-service.ts
  product-service.ts

infrastructure/
  repositories/           # Recommended but optional
    user-repository.ts
    product-repository.ts
  database/
    connection.ts
    migrations/
  # Or organize differently:
  user-repository.ts
  email-service.ts

shared/
  utils/
    format.ts
    validation.ts
  constants/
    errors.ts
  # Or just:
  format.ts
  errors.ts
```

The important thing is that files are in the correct **layer** (domain, infrastructure, etc.). How you organize within that layer is up to you.

### Layer Descriptions

#### Application Layer

The application layer handles HTTP concerns, routing, and application-level configuration:

```ts
// application/config/database.ts
export const databaseConfig = {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432'),
    database: process.env.DB_NAME ?? 'myapp',
}

// application/routes/users.ts
import { defineRoute } from '@declaro/core'

export default defineRoute({
    method: 'GET',
    path: '/users',
    handler: async (context) => {
        const userService = await context.resolve('UserService')
        return await userService.findAll()
    },
})
```

#### Domain Layer

The domain layer contains your core business logic, isolated from infrastructure concerns:

```ts
// domain/services/user-service.ts
export class UserService {
    constructor(private readonly userRepository: UserRepository) {}

    async createUser(data: CreateUserInput) {
        // Business logic here
        const user = await this.userRepository.create(data)

        // Emit domain event
        await this.context.emit({
            type: 'domain::user.created',
            payload: { userId: user.id },
        })

        return user
    }
}
```

#### Infrastructure Layer

The infrastructure layer handles external dependencies and data persistence:

```ts
// infrastructure/repositories/user-repository.ts
export class UserRepository {
    constructor(private readonly db: Database) {}

    async create(data: CreateUserInput) {
        return await this.db.users.insert(data)
    }

    async findById(id: string) {
        return await this.db.users.findOne({ id })
    }
}
```

#### Integrations Layer

The integrations layer manages third-party service integrations:

```ts
// integrations/services/stripe/payment-service.ts
import Stripe from 'stripe'

export class StripePaymentService {
    private stripe: Stripe

    constructor(config: StripeConfig) {
        this.stripe = new Stripe(config.apiKey)
    }

    async createPayment(amount: number) {
        return await this.stripe.paymentIntents.create({ amount })
    }
}
```

#### Shared Layer

The shared layer provides utilities and constants accessible across all other layers:

```ts
// shared/utils/format.ts
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(amount)
}

// shared/constants.ts
export const PASSWORD_MIN_LENGTH = 8
export const USERNAME_MAX_LENGTH = 50
```

## Module Instance

Each module is built into an instance of the `Module` class, which encapsulates the module's contexts and lifecycle. The module provides type-safe access to all registered dependencies through context resolution.

### Automatic Dependency Registration

Declaro automatically registers dependencies based on your exports, not your folder structure. Classes, functions, and values are registered using their export names:

```ts
// domain/services/user-service.ts
export class UserService {
    // Automatically registered as: domain.resolve('UserService')
}

// domain/services/product-service.ts
export class ProductService {
    // Automatically registered as: domain.resolve('ProductService')
}

// infrastructure/repositories/user-repository.ts
export class UserRepository {
    // Automatically registered as: infrastructure.resolve('UserRepository')
}

// shared/utils/format-currency.ts
export function formatCurrency(amount: number) {
    // Automatically registered as: shared.resolve('formatCurrency')
}

// application/config/database.ts
export const databaseConfig = {
    // Automatically registered as: application.resolve('databaseConfig')
}
```

**The key insight**: The folder path doesn't matter—only the export name and which top-level folder it's in (domain, infrastructure, integrations, application, or shared). You can nest files in subdirectories like `services/`, `repositories/`, `utils/`, etc., for organization without affecting how dependencies are resolved.

### Manual Dependency Registration (Override)

While automatic registration handles most cases, you can manually override or configure dependencies in the module's `index.ts` file for:

-   Custom dependency injection
-   Complex initialization logic
-   Factory patterns
-   Configuring singleton behavior
-   Setting up dependencies with specific constructor arguments

```ts
// index.ts
import { defineModule } from '@declaro/core'
import { databaseConfig } from './application/database-config'
import { UserService } from './domain/user-service'
import { UserRepository } from './infrastructure/user-repository'
import { StripePaymentService } from './integrations/stripe-payment-service'
import { createDatabase } from './infrastructure/database'

export default defineModule({
    name: 'user-module',
    description: 'User management module',

    async setup(module) {
        // Override automatic registration with custom factory
        module.infrastructure.registerFactory('Database', (config) => createDatabase(config), ['databaseConfig'])

        // Override with custom dependency injection
        module.domain.registerClass('UserService', UserService, ['UserRepository'])

        // Override integration service with custom configuration
        module.integrations.registerClass('StripePaymentService', StripePaymentService, ['stripeConfig'])
    },
})
```

You can also use a more concise registration pattern:

```ts
// index.ts - Alternative pattern
import { defineModule } from '@declaro/core'

export default defineModule({
    name: 'user-module',

    async setup(module) {
        // Override automatic registration with factory for complex initialization
        module.infrastructure.registerFactory(
            'Database',
            async (config) => {
                const db = await createDatabase(config)
                await db.connect()
                return db
            },
            ['databaseConfig'],
        )

        // Override with custom singleton configuration
        module.domain.registerClass('UserService', UserService, ['UserRepository'], {
            singleton: true,
        })
    },
})
```

### Resolving Dependencies

```ts
// APPLICATION CONTEXT
const dbConfig = await myModule.application.resolve('databaseConfig')
const appRouter = await myModule.application.resolve('router')

// DOMAIN CONTEXT
const userService = await myModule.domain.resolve('UserService')
const userController = await myModule.domain.resolve('UserController')

// INFRASTRUCTURE CONTEXT
const userRepository = await myModule.infrastructure.resolve('UserRepository')
const database = await myModule.infrastructure.resolve('Database')

// INTEGRATIONS CONTEXT
const paymentService = await myModule.integrations.resolve('StripePaymentService')

// SHARED CONTEXT
const formatCurrency = await myModule.shared.resolve('formatCurrency')
const minLength = await myModule.shared.resolve('PASSWORD_MIN_LENGTH')
```

### Event-Driven Architecture

Each context supports event emission and subscription, enabling loose coupling between components:

```ts
// DISPATCH A DOMAIN EVENT
await myModule.domain.emit({
    type: 'domain::user.created',
    payload: { userId: '123' },
})

// LISTEN FOR DOMAIN EVENTS
myModule.domain.on('domain::user.created', async (context, event) => {
    console.log('User created:', event.payload.userId)
    // Perform side effects, send notifications, etc.
})

// APPLICATION EVENTS
await myModule.application.emit({ type: 'app::router.init' })

// INFRASTRUCTURE EVENTS
await myModule.infrastructure.emit({ type: 'infrastructure::db.connected' })

// INTEGRATION EVENTS
await myModule.integrations.emit({
    type: 'integrations::stripe.webhook-registered',
})
```

### Context Middleware

Contexts can be extended with middleware to add cross-cutting concerns:

```ts
// Add authentication middleware
await myModule.application.use(async (context) => {
    context.registerFactory(
        'currentUser',
        async (request) => {
            const token = request.headers.authorization
            return await validateToken(token)
        },
        ['request'],
    )
})

// Add logging middleware
await myModule.domain.use(async (context) => {
    context.on('*', (ctx, event) => {
        console.log('Event emitted:', event.type)
    })
})
```

## The Build System

The build system generates types and other artifacts to compile each module into a usable unit. `@declaro/build` functions as a Vite plugin that processes the module's source code and compiles any available modules into output in a `.declaro` folder.

### What Gets Generated

The build system generates:

-   **Type definitions** for context scopes (`ApplicationScope`, `DomainScope`, `InfrastructureScope`, `IntegrationScope`)
-   **Module instance definition** with typed access to all contexts
-   **Auto imports** for seamless access to dependencies:
    -   Context scope types, accessible in files under `application/**`
    -   Types of exports from `domain/**`, accessible in any files inside the module
    -   Anything in `shared/**`, accessible in any files inside the module
    -   Infrastructure types and implementations, accessible in `infrastructure/**` and `application/**`
    -   Integration types and implementations, accessible in `integrations/**` and `application/**`
-   **Model artifacts** (interfaces, classes, references) based on your schema definitions

### Build-Time Optimizations

The build system provides several optimizations:

-   **Tree-shaking**: Unused dependencies are eliminated from the final bundle
-   **Type checking**: All dependencies are validated at compile time
-   **Hot module replacement**: Changes to your module are reflected immediately during development
-   **Code splitting**: Automatic chunking for optimal loading performance

### Integration with Vite/Nuxt/Next

The build system integrates seamlessly with popular build tools:

```ts
// vite.config.ts
import { declaro } from '@declaro/build'
import { defineConfig } from 'vite'

export default defineConfig({
    plugins: [
        declaro({
            models: {
                generators: [new ClassModelGenerator(), new InterfaceModelGenerator()],
            },
        }),
    ],
})
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
    vite: {
        plugins: [
            declaro({
                models: {
                    generators: [new InterfaceModelGenerator()],
                },
            }),
        ],
    },
})
```

## Configuration

The build system is configured via the `declaro.config.ts` file at the root of the module. Zero configuration is required to use the build system, but you can customize it as needed.

### Basic Configuration

```ts
import { ClassModelGenerator, InterfaceModelGenerator } from '@declaro/build'

export default {
    // Directory where generated files are placed
    declaroDirectory: '.declaro',

    // Model generation configuration
    models: {
        // Output directory for generated models (relative to declaroDirectory)
        outputDirectory: 'models',

        // Glob patterns for finding model definitions
        paths: ['**/*.model.ts', 'src/models/*.ts', '**/models/*.ts'],

        // Model generators to use
        generators: [new ClassModelGenerator(), new InterfaceModelGenerator()],
    },
}
```

### Advanced Configuration

```ts
import { ReferenceGenerator } from '@declaro/build'
import type { StaticConfig } from '@declaro/build'

export default {
    models: {
        paths: [
            // Custom model locations
            'src/domain/models/**/*.ts',
            'src/integrations/**/models/*.ts',
        ],

        generators: [
            // Generate TypeScript interfaces
            new InterfaceModelGenerator(),

            // Generate class implementations
            new ClassModelGenerator(),

            // Generate type references for imports
            new ReferenceGenerator(),
        ],
    },
} satisfies StaticConfig
```

### Dynamic Configuration

For more complex scenarios, you can export a function that returns configuration:

```ts
import type { DynamicConfig } from '@declaro/build'

export default (async () => {
    const isDevelopment = process.env.NODE_ENV === 'development'

    return {
        models: {
            generators: isDevelopment
                ? [new InterfaceModelGenerator()]
                : [new ClassModelGenerator(), new InterfaceModelGenerator()],
        },
    }
}) satisfies DynamicConfig
```

## Auto-Imports and Type Safety

One of the most powerful features of the Declaro module system is automatic import resolution and type generation.

### Generated Scope Types

After running the build system, you'll have access to typed scopes:

```ts
// Automatically generated in .declaro/types/scopes.d.ts
interface ApplicationScope {
    databaseConfig: DatabaseConfig
    router: Router
}

interface DomainScope {
    UserService: UserService
    UserController: UserController
    ProductService: ProductService
}

interface InfrastructureScope {
    UserRepository: UserRepository
    Database: Database
}

interface SharedScope {
    formatCurrency: (amount: number) => string
    PASSWORD_MIN_LENGTH: number
}
```

### Type-Safe Resolution

These generated types enable full autocomplete and type checking:

```ts
// TypeScript knows the exact type!
const dbConfig = await context.resolve('databaseConfig')
//    ^? DatabaseConfig

const userService = await context.resolve('UserService')
//    ^? UserService

// TypeScript error: Property 'nonexistent' does not exist
const invalid = await context.resolve('nonexistent')
```

### Auto-Imported Utilities

Shared utilities are automatically available without explicit imports:

```ts
// In any file within the module, if formatCurrency is in shared/
const price = formatCurrency(1999) // No import needed!

// Constants are also auto-imported
if (password.length < PASSWORD_MIN_LENGTH) {
    // PASSWORD_MIN_LENGTH is from shared/
    throw new Error('Password too short')
}
```

## Lifecycle and Initialization

Modules have a well-defined lifecycle with hooks for initialization:

```ts
import { App } from '@declaro/core'

// Create an application context
const app = new App()

// Register initialization hooks
app.onInit(async (context) => {
    console.log('Application initializing...')
    // Set up database connections, load configuration, etc.
})

app.onStart(async (context) => {
    console.log('Application starting...')
    // Start HTTP server, scheduled tasks, etc.
})

app.onDestroy(async (context) => {
    console.log('Application shutting down...')
    // Close database connections, cleanup resources, etc.
})

// Initialize and start the application
await app.init()
await app.start()

// Later, gracefully shutdown
await app.destroy()
```

## Best Practices

### 1. Keep Domain Logic Pure

Your domain layer should be isolated from infrastructure concerns:

```ts
// ✅ Good: Pure domain logic
class UserService {
    constructor(private readonly userRepository: UserRepository) {}

    async createUser(data: CreateUserInput) {
        this.validateUser(data)
        return this.userRepository.create(data)
    }
}

// ❌ Bad: Infrastructure concerns in domain
class UserService {
    async createUser(data: CreateUserInput) {
        await fetch('https://api.example.com/validate', {
            /* ... */
        })
    }
}
```

### 2. Use Events for Cross-Module Communication

Prefer events over direct dependencies between modules:

```ts
// ✅ Good: Event-driven
await context.emit({
    type: 'domain::order.created',
    payload: { orderId: order.id },
})

// ❌ Bad: Direct coupling
await emailModule.sendOrderConfirmation(order.id)
```

### 3. Leverage Type Generation

Let the build system generate types instead of maintaining them manually:

```ts
// ✅ Good: Define once, types generated
export const userSchema = defineModel('User', {
    type: 'object',
    properties: {
        id: { type: 'string' },
        name: { type: 'string' },
    },
})

// ❌ Bad: Manual type maintenance
export interface User {
    id: string
    name: string
}
export const userSchema = { type: 'object' /* ... */ }
```

### 4. Organize by Feature, Not by Type

Group related files together rather than separating by technical type:

```
✅ Good:
modules/
  user/
    domain/user-service.ts
    domain/user-created-event.ts
    infrastructure/user-repository.ts

❌ Bad:
services/
  user-service.ts
  product-service.ts
repositories/
  user-repository.ts
  product-repository.ts
```

## Comparison with Other Frameworks

### vs. Nuxt/Next.js

-   **Similarities**: File-based conventions, auto-imports, build-time optimizations
-   **Differences**: Declaro is backend-focused with emphasis on domain modeling and dependency injection

### vs. NestJS

-   **Similarities**: Modular architecture, dependency injection, decorators (optional)
-   **Differences**: Declaro uses file-based conventions and compile-time type generation instead of runtime reflection

### vs. Traditional Layered Architecture

-   **Similarities**: Separation of concerns, clear boundaries between layers
-   **Differences**: Declaro enforces separation through folder structure and provides automatic wiring
