#!/usr/bin/env bun
/**
 * Integration test for ZodModel exports
 *
 * This test verifies that ZodModel imported from the dist folder
 * creates proper class instances with correct prototype chains.
 * This catches the dual package hazard issue that caused instanceof
 * checks to fail in CI environments.
 *
 * Run this after building: bun run scripts/integration-test.ts
 */

import { resolve } from 'path'
import { z } from 'zod/v4'

console.log('🧪 Running ZodModel integration test...\n')

// Import from dist (ESM) - simulates how consumers use the package
const distPath = resolve(__dirname, '../dist/node/index.js')
console.log(`📦 Importing from: ${distPath}`)

// Dynamic import to ensure we're loading from dist
const { ZodModel } = await import(distPath)

// Also import Model from @declaro/core for instanceof check
const { Model } = await import('@declaro/core')

// Test 1: Create instance
console.log('\n✓ Test 1: Create ZodModel instance')
const schema = z.object({
    name: z.string(),
    age: z.number(),
})
const model = new ZodModel('TestUser', schema)

// Test 2: Check type
console.log('✓ Test 2: Verify instance type')
if (typeof model !== 'object') {
    console.error('❌ FAIL: model is not an object')
    process.exit(1)
}
console.log(`  - typeof model: ${typeof model}`)

// Test 3: Check it's not a plain object
console.log("✓ Test 3: Verify it's not a plain object")
const keys = Object.keys(model)
console.log(`  - Object.keys(model): [${keys.join(', ')}]`)
if (keys.length < 2) {
    console.error('❌ FAIL: model appears to be a plain object with minimal keys')
    process.exit(1)
}

// Test 4: instanceof ZodModel
console.log('✓ Test 4: Check instanceof ZodModel')
if (!(model instanceof ZodModel)) {
    console.error('❌ FAIL: model instanceof ZodModel is false')
    console.error(`  - Prototype: ${Object.getPrototypeOf(model)}`)
    console.error(`  - Constructor: ${model.constructor?.name}`)
    process.exit(1)
}
console.log('  - model instanceof ZodModel: true')

// Test 5: instanceof Model
console.log('✓ Test 5: Check instanceof Model (base class)')
if (!(model instanceof Model)) {
    console.error('❌ FAIL: model instanceof Model is false')
    console.error(`  - This indicates a dual package hazard or broken prototype chain`)
    process.exit(1)
}
console.log('  - model instanceof Model: true')

// Test 6: Prototype chain
console.log('✓ Test 6: Verify prototype chain')
const proto1 = Object.getPrototypeOf(model)
const proto2 = Object.getPrototypeOf(proto1)
console.log(`  - ZodModel.prototype: ${proto1 === ZodModel.prototype}`)
console.log(`  - Model.prototype: ${proto2 === Model.prototype}`)
if (proto1 !== ZodModel.prototype || proto2 !== Model.prototype) {
    console.error('❌ FAIL: Prototype chain is broken')
    process.exit(1)
}

// Test 7: Constructor name
console.log('✓ Test 7: Check constructor name')
if (model.constructor.name !== 'ZodModel') {
    console.error(`❌ FAIL: constructor.name is "${model.constructor.name}", expected "ZodModel"`)
    process.exit(1)
}
console.log(`  - constructor.name: ${model.constructor.name}`)

// Test 8: Properties exist
console.log('✓ Test 8: Check expected properties')
const expectedProps = ['name', 'schema', 'validate', 'toJSONSchema', 'labels']
const missingProps = expectedProps.filter((prop) => !(prop in model))
if (missingProps.length > 0) {
    console.error(`❌ FAIL: Missing properties: ${missingProps.join(', ')}`)
    process.exit(1)
}
console.log(`  - All expected properties exist: ${expectedProps.join(', ')}`)

// Test 9: Methods are functions
console.log('✓ Test 9: Check methods are functions')
const methods = ['validate', 'toJSONSchema', 'stripExcludedFields']
for (const method of methods) {
    if (typeof (model as any)[method] !== 'function') {
        console.error(`❌ FAIL: ${method} is not a function`)
        process.exit(1)
    }
}
console.log(`  - All methods are functions: ${methods.join(', ')}`)

// Test 10: Validate works
console.log('✓ Test 10: Test validate functionality')
try {
    const result = await model.validate({ name: 'Alice', age: 30 })
    if (!result.value) {
        console.error('❌ FAIL: validate did not return expected result')
        process.exit(1)
    }
    console.log(`  - validate() works correctly`)
} catch (error) {
    console.error('❌ FAIL: validate() threw an error')
    console.error(error)
    process.exit(1)
}

console.log('\n✅ All integration tests passed!')
console.log('   ZodModel exports are working correctly from dist folder\n')
