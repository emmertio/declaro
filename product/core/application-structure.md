# Declaro 2.0 Application Structure

Applications are typically comprised of several types of dependencies:

-   Configurations
-   Domain models & schema definitions
-   Infrastructure services (e.g., database, cache, messaging)
-   Infrastructure repository implementations
-   Domain services
-   Domain controllers

## Application Class and Contexts

An application structure could look like this:

```ts
class App {
    config = new Context<ConfigScope>()
    infrastructure = new Context<InfrastructureScope>()
    domain = new Context<DomainScope>()
    application = new Context<ApplicationScope>()
}
```

## The Declaro CLI

The Declaro CLI provides commands to manage the application lifecycle, including preparing, building, and running the application.

Commands:

-   `declaro prepare`: Prepares the application by generating necessary artifacts.
-   `declaro build`: Builds the application for production.
-   `declaro preview`: Runs the application.
-   `declaro dev`: Runs the application in development mode with auto-restarting.

## The .declaro folder

The `.declaro` folder contains generated dev-time artifacts such as auto-imports and type definitions. This folder is created when running `declaro prepare` or `declaro build` commands.

## Lifecycle Events

Each context has its own lifecycle events. Application contexts can also orchestrate events from other contexts.

-   Config only has access to dispatch and subscribe to config events.
-   Infrastructure has access to dispatch and subscribe to infrastructure events.
-   Domain has access to dispatch and subscribe to domain events.
-   Application has access to dispatch and subscribe to application events, config events, infrastructure events, and domain events.

1. Config

    - config::config.load: Load configuration settings from environment variables, files, or other sources.
    - config::config.validate: Validate configuration settings.

2. Infrastructure

    - infrastructure::app.init infrastructure dependencies (e.g., database connections, cache clients, repositories, etc).

3. Domain

    - domain::schema.init domain models and schema.
    - domain::app.init Implement domain services and controllers.

4. Application
    - app::app.init Initialize application-level services.
    - app::router.init Set up routes
    - app::subscribers.init Set up subscribers
    - app::cron.init Set up cron jobs
    - app::server.start Start the application server
