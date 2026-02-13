# Integration Tests

These integration tests verify that the ZodModel class works correctly when imported from the compiled dist folder, simulating how consumers would use the package.

## Why These Tests Exist

The integration tests prevent a **dual package hazard** issue where:

- The package exports both source TypeScript files (`"bun": "./src/index.ts"`)
- AND compiled JavaScript files (`"import": "./dist/node/index.js"`)

In CI environments with cached node_modules, different parts of the code can load different versions of the same class, causing:

- `instanceof` checks to fail
- Constructor returning plain objects instead of class instances
- Broken prototype chains

## Test Files

### `integration-test.ts`

Tests the ESM export (`dist/node/index.js`):

- Verifies ZodModel creates proper class instances
- Checks `instanceof` works correctly
- Validates prototype chain integrity
- Tests that all methods are accessible

### `integration-test-cjs.ts`

Tests the CommonJS export (`dist/node/index.cjs`):

- Verifies CJS consumers get proper class instances
- Checks `instanceof` works with CJS modules
- Ensures no dual package hazard between CJS/ESM

## Running Tests

```bash
# Run both ESM and CJS integration tests
bun run test:integration

# Or run individually
bun run scripts/integration-test.ts
bun run scripts/integration-test-cjs.ts
```

## CI Integration

These tests run automatically in CI after the build step to catch export issues before they reach production.

## Related Issue

See the root cause analysis in the issue description for why removing the `"bun"` export fixed the CI failures.
