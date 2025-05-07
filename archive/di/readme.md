# Declaro Dependency Injection

Manage your application's dependencies in a declarative and typesafe fashion.

### Values

1. Reduce human error factors. We shouldn't have to coerce types or rely on developers to remember which dependencies can map to which args.
2. First-class typing. Everything should be type introspected. Yes, we mean literally everything. The framework will type check keys used to inject args to make sure they map back to dependencies of the correct type. We do this without requiring you to use a single generic type (although we make great use of them under the hood on your behalf).
3. Dependency replacement. Often times a dependency will need to be replaced. However, this can lead to issues when the new dependency is a different type than the old one. That's why we allow you to replace existing dependencies, but we do enforce types on replacements.
4. Dumb consumers. We believe you shouldn't need to know if a dependency is a singleton, factory, etc. in order to use it.
5. Free consumers. We believe you should be able to tell the framework how you want things resolved. There are times when you want to explicitly force the framework to give you a non-cached value (i.e. not a singleton). We allow you to make these decisions upon dependency resolution while still maintaining our other values.

### Dependency types supported

-   values
-   factories
-   classes
-   promise values
-   async factories
-   async classes (normal classes that depend on async things)

### Other features

-   singletons
-   dependency replacement
-   merging containers
-   forking containers
