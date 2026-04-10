#!/usr/bin/env bun
/**
 * Integration test for ZodModel CommonJS exports
 *
 * This test verifies that ZodModel imported from the CommonJS dist
 * creates proper class instances with correct prototype chains.
 *
 * Run this after building: bun run scripts/integration-test-cjs.ts
 */

import { resolve } from 'path'
import { z } from 'zod/v4'

console.log('🧪 Running ZodModel CommonJS integration test...\n')

// Import from dist/node/index.cjs - simulates how CJS consumers use the package
const distPath = resolve(__dirname, '../dist/node/index.cjs')
console.log(`📦 Importing from: ${distPath}`)

// Dynamic import (Bun can import CJS)
const zodModule = await import(distPath)
const { ZodModel } = zodModule

// Also import Model from @declaro/core CJS for instanceof check
// In a real CJS environment, both would be required from CJS
const coreDistPath = resolve(__dirname, '../../core/dist/node/index.cjs')
const coreModule = await import(coreDistPath)
const { Model } = coreModule

// Test 1: Create instance
console.log('\n✓ Test 1: Create ZodModel instance from CJS export')
const schema = z.object({
    name: z.string(),
    age: z.number(),
})
const model = new ZodModel('TestUser', schema)

// Test 2: instanceof checks
console.log('✓ Test 2: Check instanceof ZodModel')
if (!(model instanceof ZodModel)) {
    console.error('❌ FAIL: model instanceof ZodModel is false')
    process.exit(1)
}
console.log('  - model instanceof ZodModel: true')

console.log('✓ Test 3: Check instanceof Model (base class)')
if (!(model instanceof Model)) {
    console.error('❌ FAIL: model instanceof Model is false')
    console.error('  - This indicates a dual package hazard between CJS and ESM')
    process.exit(1)
}
console.log('  - model instanceof Model: true')

// Test 4: Validate works
console.log('✓ Test 4: Test validate functionality')
try {
    const result = await model.validate({ name: 'Bob', age: 25 })
    if (!result.value) {
        console.error('❌ FAIL: validate did not return expected result')
        process.exit(1)
    }
    console.log('  - validate() works correctly')
} catch (error) {
    console.error('❌ FAIL: validate() threw an error')
    console.error(error)
    process.exit(1)
}

console.log('\n✅ All CommonJS integration tests passed!')
console.log('   ZodModel CJS exports are working correctly\n')
