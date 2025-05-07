# Declaro Ecosystem

Declaro is Spanish for "To Declare." The Declaro ecosystem is designed to enable developers to define software in composable business modules that can be customized at any level and re-composed. This approach provides flexibility, scalability, and maintainability for modern applications.

## Packages

### [@declaro/core](./lib/core/README.md)

The `@declaro/core` package is the foundation of the Declaro framework. It provides essential utilities and abstractions for building scalable and maintainable applications. Key features include:

-   **Event Management**: A robust event manager for handling custom events and listeners.
-   **Validation**: Flexible and extensible validation utilities for synchronous and asynchronous use cases.
-   **Dependency Injection**: A powerful context-based dependency injection system with support for factories, singletons, and eager initialization.

For more details, see the [Core Library README](./lib/core/README.md).

### [@declaro/redis](./lib/redis/readme.md)

The `@declaro/redis` package provides tools to integrate Redis features into your application. These features include:

-   **Key-Value Store**: Efficiently store and retrieve key-value pairs.
-   **Configuration Store**: Manage application configurations using Redis.
-   **Message Queues**: Implement message queues for asynchronous processing.

For more details, see the [Redis Library README](./lib/redis/readme.md).

## Contributing

We welcome contributions from the community! To get started, please read the [Contributing Guidelines](./CONTRIBUTING.md).

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE.md) file for details.
