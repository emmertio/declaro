# @declaro/auth

A simple authentication library for Declaro projects.

## Features

-   Basic username and password authentication

## Installation

### bun

```bash
bun add @declaro/auth
```

### npm

```bash
npm install @declaro/auth
```

### yarn

```bash
yarn add @declaro/auth
```

## Usage

### Getting an AuthSession from AuthService

To create an `AuthSession` using the `AuthService`, you can use the `createSession` method. Here's an example:

```typescript
import { AuthService } from './domain/services/auth-service'
import type { IAuthSessionInput, IAuthSession } from './domain/models/auth-session'

class MyAuthService extends AuthService {
    async saveSession(session: IAuthSession): Promise<IAuthSession> {
        // Implement saving logic here
        return session
    }

    async getSession(id: string): Promise<IAuthSession | null> {
        // Implement retrieval logic here
        return null
    }

    async deleteSession(id: string): Promise<void> {
        // Implement deletion logic here
    }
}

const authService = new MyAuthService({
    /* provide AuthConfig */
})

const input: IAuthSessionInput = {
    jwt: 'your-jwt-token',
    roles: ['user'],
    claims: ['read', 'write'],
}

async function createSessionExample() {
    const session = await authService.createSession(input)
    console.log('Created AuthSession:', session)
}

async function getSessionExample() {
    const sessionId = 'auth-session-id'
    const session = await authService.getSession(sessionId)
    console.log('Retrieved AuthSession:', session)
}

createSessionExample()
getSessionExample()
```

### Using RedisAuthService to Manage AuthSessions

The `RedisAuthService` provides a default implementation for managing `AuthSession` objects. Here's an example:

```typescript
import { RedisAuthService } from './domain/services/redis-auth-service'
import type { IAuthSessionInput, IAuthSession } from './domain/models/auth-session'

const redisAuthService = new RedisAuthService({
    /* provide AuthConfig */
})

const input: IAuthSessionInput = {
    jwt: 'your-jwt-token',
    roles: ['user'],
    claims: ['read', 'write'],
}

async function createSessionWithRedis() {
    const session = await redisAuthService.createSession(input)
    console.log('Created AuthSession with Redis:', session)
}

async function getSessionWithRedis() {
    const sessionId = 'auth-session-id'
    const session = await redisAuthService.getSession(sessionId)
    console.log('Retrieved AuthSession with Redis:', session)
}

createSessionWithRedis()
getSessionWithRedis()
```

## License

MIT
