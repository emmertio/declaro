---
mode: agent
---

Create a new library package with the given name.

Package Naming:
Package.json: Ensure the library package name is prefixed with @declaro/ unless specified otherwise. Example: @declaro/my-library
Library folder: Libraries should be stored in the lib folder. Example: lib/my-library.

Basic library structure:

-   package.json
    -   name: Be sure the package is named according to the package naming rules.
    -   version: The version of all packages is pegged to the monorepo version. See lerna.json for the current version.
    -   description: A brief description of the library.
    -   license: The license for the library, typically MIT.
    -   scripts: Include scripts for building, cleaning, testing, and if necessary developing the library. Reference the core package as a good example of how to do this. The scripts attribute of the core package should be almost exactly copy-pastable to other packages.
    -   devDependencies: Make sure to include the necessary packages for the build script to run. Be sure to use the latest version of each package, explicitly referenced in package.json with ^. Do not use the :latest tag where possible. Get the official numbers from NPM.
        -   @types/bun
        -   typescript
        -   any additional dependencies required to make the build script work, or as prompted.
    -   peerDependencies: Include any @declaro/\* packages that the library depends on. These should be installed by the consumer of the library.
    -   exports: You can copy the exports from the core package, but ensure that they are appropriate for the library. The exports should point to the entry point of the library and any other files that should be accessible to consumers.
-   scripts/
    -   build.ts: Copy this from the core package. You can copy this file vurbatim.
-   tsconfig.json: Use the core package's tsconfig.json as a template. You can typically copy this file verbatim.
-   src/
    -   index.ts: This is the entry point for the library. You can copy this from the core package.
    -   other files: Add any additional files needed for the library, based on the prompt from the user.
-   README.md: A basic README file that describes the library, its purpose, and how to use it. You can copy the structure from the core package's README. When giving installation instructions, give them with bun, yarn, and npm.
-   .gitignore: Copy the .gitignore from the core package to ensure that common files are ignored.

Ensure that the library is set up to be built and tested correctly, and that it follows the conventions used in the core package.
