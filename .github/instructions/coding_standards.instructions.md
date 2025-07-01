---
applyTo: '**'
---

## Tech Stack

-   Use bun for package management, build scripts, and testing.
-   Use strict typescript for type safety.

## Coding Standards

Variable names should be plain english in camelCase.
Boolean variable names should be prefixed with `is`, `has`, or `can` to indicate their purpose.

Favor composition over inheritance.

## Testing

Use bun's native test framework where possible.

Some legacy code may use tests defined in vitest or jest. These should be upgraded to bun's native testing framework where practical. Otherwise, they can stay as they are, but new tests should be written using bun's native test framework.

Store tests next to their implementation files. If a `test` directory exists nearby, you can place mock implementations and test utils in there, but the tests should be in the same directory as the implementation files.

## Documentation

-   Use JSDoc for inline documentation.
-   When generating code, make sure to include JSDoc comments for:
    -   Exports
    -   Classes
    -   Class methods
    -   Enums
    -   Enum values
    -   Interfaces
    -   Types

## Dependencies

Select dependencies that are well-maintained and have a good reputation in the community. Avoid using deprecated or unmaintained packages. Review:

-   The number of contributors
-   The frequency of releases, and length of time since the last release.
-   The number of stars on Github
-   The number of weekly downloads on NPM

Install all dependencies using bun.

Run all util methods relating to dependencies using bun.

Tag version numbers using the latest version currently available on the NPM registry using the `^` prefix. Do not use the `:latest` tag unless the packages readme explicity says it is best practice to do so.

Install internal utils as devDependencies so that Bun will bundle them.
Install packages that may be a core element of library consumers' implementation projects as peer-dependencies.
Install all other @declaro/\* packages as peer dependencies and devDependencies as prompted.
