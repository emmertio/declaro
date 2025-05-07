# Core Library

The Core Library is a foundational module designed to provide essential utilities and abstractions for building scalable and maintainable applications. It includes features such as event management, validation, dependency injection, and more.

## Features

-   **Event Management**: A robust event manager for handling custom events and listeners.
-   **Validation**: Flexible and extensible validation utilities for synchronous and asynchronous use cases.
-   **Dependency Injection**: A powerful context-based dependency injection system with support for factories, singletons, and eager initialization.

## Installation

To install the Core Library, use npm or yarn:

```bash
npm install @declaro/core
```

or

```bash
yarn add @declaro/core
```

## Usage

### Event Management

The `EventManager` class allows you to manage custom events and listeners.

```typescript
import { EventManager, IEvent } from '@declaro/core'

class MyEvent implements IEvent {
    constructor(public readonly type: string) {}
}

const eventManager = new EventManager<MyEvent>()

// Add a listener
const removeListener = eventManager.on('my-event', (event) => {
    console.log(`Event received: ${event.type}`)
})

// Emit an event
const event = new MyEvent('my-event')
eventManager.emit(event)

// Remove the listener
removeListener()
```

### Validation

The `validate` and `validateAny` functions provide a flexible way to validate data.

```typescript
import { validate } from '@declaro/core'

const value = { message: 'Hello World' }

const result = await validate(value, (val) => val.message === 'Hello World')

if (result.valid) {
    console.log('Validation passed!')
} else {
    console.log('Validation failed!')
}
```

### Dependency Injection

The `Context` class provides a powerful dependency injection system.

```typescript
import { Context } from '@declaro/core'

type AppScope = {
    foo: string
    bar: number
}

const context = new Context<AppScope>()

context.registerValue('foo', 'Hello')
context.registerValue('bar', 42)

const foo = context.resolve('foo')
const bar = context.resolve('bar')

console.log(foo) // Output: Hello
console.log(bar) // Output: 42
```

## Setting Up and Resolving Factories, Classes, and Async Factories

The Core Library's `Context` class provides a powerful dependency injection system that supports factories, classes, and async factories. Below are examples of how to set up and resolve these dependencies.

### Registering and Resolving Factories

Factories are functions that produce values. You can register a factory with the `Context` class and resolve it when needed.

```typescript
import { Context } from '@declaro/core'

type AppScope = {
    greeting: string
}

const context = new Context<AppScope>()

context.registerFactory('greeting', (name: string) => `Hello, ${name}!`, ['name'])

context.registerValue('name', 'World')

const greeting = context.resolve('greeting')
console.log(greeting) // Output: Hello, World!
```

### Registering and Resolving Classes

Classes can also be registered as dependencies. The `Context` class will handle their instantiation and dependency injection.

```typescript
import { Context } from '@declaro/core'

class Greeter {
    constructor(public name: string) {}

    greet() {
        return `Hello, ${this.name}!`
    }
}

type AppScope = {
    greeter: Greeter
    name: string
}

const context = new Context<AppScope>()

context.registerValue('name', 'World')
context.registerClass('greeter', Greeter, ['name'])

const greeter = context.resolve('greeter')
console.log(greeter.greet()) // Output: Hello, World!
```

### Registering and Resolving Async Factories

Async factories are useful for dependencies that require asynchronous initialization.

```typescript
import { Context } from '@declaro/core'

type AppScope = {
    asyncGreeting: Promise<string>
}

const context = new Context<AppScope>()

context.registerAsyncFactory(
    'asyncGreeting',
    async (name: string) => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        return `Hello, ${name}!`
    },
    ['name'],
)

context.registerValue('name', 'World')
;(async () => {
    const asyncGreeting = await context.resolve('asyncGreeting')
    console.log(asyncGreeting) // Output: Hello, World!
})()
```

### Singleton and Eager Initialization

You can configure factories and classes to be singletons or eagerly initialized. Singletons are instantiated only once, while eager initialization ensures that dependencies are proactively created and cached when calling `initializeEagerDependencies`, which is typically called as a part of your app's setup (or test suite setup).

```typescript
context.registerFactory('singletonFactory', () => 'Singleton Value', [], { singleton: true })
context.registerClass('eagerClass', SomeClass, [], { eager: true })

await context.initializeEagerDependencies()
```

## Testing

The Core Library includes comprehensive tests to ensure reliability. To run the tests, use the following command:

```bash
yarn test
```

## Contributing

Contributions are welcome! Please follow the guidelines in the [CONTRIBUTING.md](../../CONTRIBUTING.md) file.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
