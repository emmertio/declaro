# @declaro/redis

Redis integration for Declaro. Provides pub/sub messaging, message queues, key-value storage, configuration management, event synchronization across instances, and a repository pattern for Redis data.

## Installation

```bash
bun add @declaro/redis
# or
npm install @declaro/redis
```

**Peer dependencies:** `@declaro/core`, `ioredis`

## Table of Contents

- [Overview](#overview)
- [Setup](#setup)
- [Key-Value Storage](#key-value-storage)
- [Pub/Sub Messaging](#pubsub-messaging)
- [Message Queues](#message-queues)
- [RedisRepository](#redisrepository)
- [Event Synchronization](#event-synchronization)
- [Configuration Management](#configuration-management)
- [Testing](#testing)

---

## Overview

The Redis package provides several patterns for distributed applications:

| Feature | Pattern | Use Case |
|---|---|---|
| Storage | GET/SET | Simple key-value caching |
| Pub/Sub | PUBLISH/PSUBSCRIBE | Real-time notifications |
| Queues | LPUSH/BRPOP | Background job processing |
| Repository | GET/SET with events | Observable data store |
| Event Adapter | Bidirectional bridge | Multi-instance event sync |
| Config | HSET/HGET | Application/tenant settings |

---

## Setup

### Using Redis Middleware with Context

```typescript
import { redisMiddleware, useRedis } from '@declaro/redis'
import { Context, App } from '@declaro/core'

const context = new Context()
const app = new App(context)

// Register Redis (connects on App.init, disconnects on App.destroy)
await context.use(redisMiddleware({
    host: 'localhost',
    port: 6379,
    password: 'optional',
}))

await app.init()  // Redis connection established

// Access the Redis client anywhere
const redis = useRedis(context)
await redis.ping() // "PONG"

await app.destroy() // Redis connection closed
```

### Direct Client Access

```typescript
import { useRedis, createRedis } from '@declaro/redis'

// Get the shared Redis client
const redis = useRedis(context)

// Create a new, independent Redis connection
const dedicatedClient = createRedis(context)
```

### Lifecycle Events

The middleware emits events you can listen to:

```typescript
context.on('redis:connect', async () => {
    console.log('Redis connected')
})

context.on('redis:destroy', async () => {
    console.log('Redis disconnecting')
})
```

---

## Key-Value Storage

Simple typed get/set operations using the context:

```typescript
import { set, get } from '@declaro/redis'

interface UserPreferences {
    theme: 'light' | 'dark'
    language: string
    notifications: boolean
}

// Store a value (JSON serialized automatically)
await set<UserPreferences>(context, 'user:123:prefs', {
    theme: 'dark',
    language: 'en',
    notifications: true,
})

// Retrieve a value (JSON deserialized automatically)
const prefs = await get<UserPreferences>(context, 'user:123:prefs')
// { theme: 'dark', language: 'en', notifications: true }
```

---

## Pub/Sub Messaging

Fire-and-forget messaging for real-time communication between services:

### Publishing Messages

```typescript
import { sendMessage } from '@declaro/redis'

// Publish to a channel (returns number of subscribers who received it)
const listeners = await sendMessage(context, 'notifications', {
    type: 'order-shipped',
    orderId: 'order-456',
    userId: 'user-123',
})

console.log(`${listeners} subscribers received the message`)
```

### Subscribing to Messages

```typescript
import { onMessage } from '@declaro/redis'

// Subscribe to messages (supports glob patterns)
const subscriber = onMessage(context, 'notifications', (message) => {
    console.log('Received:', message)
    // { type: 'order-shipped', orderId: 'order-456', userId: 'user-123' }
})

// Subscribe to multiple channels
onMessage(context, ['orders', 'payments', 'notifications'], (message) => {
    console.log('Received:', message)
})

// Stop listening
await subscriber.quit()
```

Messages are automatically serialized to JSON on publish and deserialized on receive.

---

## Message Queues

Reliable task queues using LPUSH/BRPOP for background job processing:

### Publishing Tasks

```typescript
import { pushMessage } from '@declaro/redis'

// Push a task to a queue
await pushMessage(context, 'email-queue', {
    to: 'user@example.com',
    subject: 'Welcome!',
    template: 'welcome-email',
})

// Push to multiple queues at once
await pushMessage(context, ['email-queue', 'audit-log'], {
    action: 'user-registered',
    userId: 'user-123',
})
```

### Consuming Tasks

```typescript
import { onFulfillMessage } from '@declaro/redis'

// Start consuming from a queue
const stop = await onFulfillMessage(context, 'email-queue', async (task) => {
    console.log('Processing:', task)
    await sendEmail(task.to, task.subject, task.template)
    // If this throws, the message is re-queued automatically
})

// Stop the consumer
stop()
```

**Reliability:** If the handler throws an error, the message is pushed back onto the queue for retry. Messages are only consumed (removed) on successful processing.

---

## RedisRepository

An observable key-value store with event handlers for monitoring changes:

```typescript
import { RedisRepository, RedisRepositoryEvent } from '@declaro/redis'

const sessionRepo = new RedisRepository<SessionData>(redisClient)

// Store data
await sessionRepo.set('session-123', {
    userId: 'user-456',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
})

// Retrieve data
const session = await sessionRepo.get('session-123')
```

### Event Handlers

Subscribe to repository changes:

```typescript
// Listen to SET operations
const unsubscribe = sessionRepo.onSet((event, id, item) => {
    console.log(`Session ${id} was stored:`, item)
})

// Listen to GET operations
sessionRepo.onGet((event, id, item) => {
    console.log(`Session ${id} was accessed`)
})

// Clean up
unsubscribe()
```

---

## Event Synchronization

The `RedisEventAdapter` bridges Declaro's `EventManager` with Redis pub/sub, enabling event synchronization across multiple application instances:

```typescript
import { RedisEventAdapter } from '@declaro/redis'
import { EventManager } from '@declaro/core'

const events = new EventManager()

// Create dedicated pub/sub connections
const publisher = new Redis(redisOptions)
const subscriber = new Redis(redisOptions)

const adapter = new RedisEventAdapter(events, publisher, subscriber)

// Now events emitted locally are published to Redis...
events.emit({ type: 'order:created', data: { orderId: '123' } })
// ...and events from other instances are received locally

events.on('order:created', (event) => {
    // This fires for both local and remote events
    console.log('Order created:', event.data)
})

// Clean up
adapter.unsubscribe()
```

### How It Works

1. Local events emitted on the `EventManager` are published to a Redis channel named by the event type
2. Events received from Redis are re-emitted on the local `EventManager`
3. A `__fromRedis` flag prevents circular republishing

This enables multi-instance architectures where events from any instance are visible to all others.

---

## Configuration Management

### Config (Single Value)

Store and retrieve configuration values with defaults:

```typescript
import { Config } from '@declaro/redis'

const emailConfig = new Config<{
    smtpHost: string
    smtpPort: number
    fromAddress: string
}>('email', {
    smtpHost: 'localhost',
    smtpPort: 587,
    fromAddress: 'noreply@example.com',
})

// Get config (returns default if not set)
const config = await emailConfig.get(context)
// { smtpHost: 'localhost', smtpPort: 587, fromAddress: 'noreply@example.com' }

// Update config (deep merges with existing)
await emailConfig.set(context, { smtpHost: 'smtp.sendgrid.net' })

// Next get returns merged result
const updated = await emailConfig.get(context)
// { smtpHost: 'smtp.sendgrid.net', smtpPort: 587, fromAddress: 'noreply@example.com' }
```

Config values are stored at `DeclaroSettings:{namespace}` in Redis.

### ConfigSet (Per-Key Configuration)

Store per-tenant or per-entity configuration using Redis hash sets:

```typescript
import { ConfigSet } from '@declaro/redis'

const tenantSettings = new ConfigSet<{
    domain: string
    email: string
    maxUsers: number
}>('TenantSettings', {
    domain: 'http://localhost:8080',
    email: 'admin@declaro.io',
    maxUsers: 100,
})

// Set config for a specific tenant
await tenantSettings.set(context, 'tenant-acme', {
    domain: 'https://acme.example.com',
    email: 'admin@acme.com',
    maxUsers: 500,
})

// Get config for a tenant (merged with defaults)
const acmeConfig = await tenantSettings.get(context, 'tenant-acme')
// { domain: 'https://acme.example.com', email: 'admin@acme.com', maxUsers: 500 }

// Get all tenant configs
const allConfigs = await tenantSettings.getAll(context)
// { 'tenant-acme': { ... }, 'tenant-beta': { ... } }
```

### Built-in Site Config

A predefined `ConfigSet` for site-wide settings:

```typescript
import { siteConfig } from '@declaro/redis'

// Configure a site
await siteConfig.set(context, 'main', {
    domain: 'https://myapp.com',
    email: 'admin@myapp.com',
})

// Retrieve site config (defaults from APP_DOMAIN and APP_EMAIL env vars)
const config = await siteConfig.get(context, 'main')
```

---

## Testing

Use the mock Redis middleware for tests that don't need a real Redis server:

```typescript
import { mockRedisMiddleware } from '@declaro/redis'
import { Context } from '@declaro/core'

const context = new Context()
await context.use(mockRedisMiddleware())

// All Redis operations work in-memory via ioredis-mock
const redis = useRedis(context)
await redis.set('key', 'value')
const result = await redis.get('key') // "value"
```

The mock middleware registers in-memory Redis instances for the client, publisher, and subscriber connections, so all features (pub/sub, queues, storage) work without an actual Redis server.
