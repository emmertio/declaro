import { describe, expect, it } from 'bun:test'
import { Context } from './context'

/**
 * Comprehensive performance test suite for Context dependency injection.
 *
 * These tests both demonstrate performance capabilities and enforce specific
 * performance requirements that will fail if the system degrades beyond
 * acceptable limits.
 */
describe('Context - Performance Tests', () => {
    /**
     * Test resolution performance and scaling with large numbers of dependencies
     */
    it('should resolve large numbers of simple dependencies efficiently', () => {
        const testSizes = [1000, 5000, 10000]
        const timings: Array<{ size: number; timeMs: number }> = []

        for (const size of testSizes) {
            type LargeScope = Record<string, string>
            const context = new Context<LargeScope>()

            // Register dependencies
            console.time(`Register ${size} dependencies`)
            for (let i = 0; i < size; i++) {
                context.registerValue(`dep_${i}` as keyof LargeScope, `value_${i}`)
            }
            console.timeEnd(`Register ${size} dependencies`)

            // Warm up JIT for consistent measurements
            for (let i = 0; i < Math.min(10, size); i++) {
                context.resolve(`dep_${i}` as keyof LargeScope)
            }

            // Measure resolution time
            const startTime = performance.now()
            for (let i = 0; i < size; i++) {
                const value = context.resolve(`dep_${i}` as keyof LargeScope)
                if (i < 10) expect(value).toBe(`value_${i}`) // Verify correctness for first few
            }
            const endTime = performance.now()

            const timeMs = endTime - startTime
            timings.push({ size, timeMs })
            console.log(`Resolution time for ${size} dependencies: ${timeMs.toFixed(2)}ms`)
        }

        // Performance requirements: resolution should scale reasonably
        const timePerDep = timings.map((t) => t.timeMs / t.size)
        timePerDep.forEach((tpd, index) => {
            const size = testSizes[index]
            // Allow higher per-dependency time for smaller sets (JIT warmup overhead)
            const maxTimePerDep = size < 5000 ? 0.002 : 0.001
            expect(tpd).toBeLessThan(maxTimePerDep)
        })

        // Verify scaling doesn't degrade catastrophically
        const maxTimePerDep = Math.max(...timePerDep)
        const minTimePerDep = Math.min(...timePerDep)
        expect(maxTimePerDep / minTimePerDep).toBeLessThan(5)
    })

    /**
     * Test singleton caching performance and efficiency
     */
    it('should demonstrate efficient singleton caching', () => {
        const dependencyCount = 2000
        type SingletonScope = Record<string, string>
        const context = new Context<SingletonScope>()

        let factoryCallCount = 0

        // Register expensive singleton factories
        console.time('Register singleton factories')
        for (let i = 0; i < dependencyCount; i++) {
            context.registerFactory(
                `singleton_${i}` as keyof SingletonScope,
                () => {
                    factoryCallCount++
                    // Simulate expensive computation
                    let result = `computed_${i}`
                    for (let j = 0; j < 1000; j++) {
                        result = result + '_' + Math.random().toString(36).substring(7)
                    }
                    return result.substring(0, 50)
                },
                [],
                { singleton: true },
            )
        }
        console.timeEnd('Register singleton factories')

        // First resolution (should call factories)
        const firstResolveStart = performance.now()
        for (let i = 0; i < dependencyCount; i++) {
            context.resolve(`singleton_${i}` as keyof SingletonScope)
        }
        const firstResolveTime = performance.now() - firstResolveStart
        expect(factoryCallCount).toBe(dependencyCount)

        // Second resolution (should use cache)
        const secondResolveStart = performance.now()
        for (let i = 0; i < dependencyCount; i++) {
            const value = context.resolve(`singleton_${i}` as keyof SingletonScope)
            if (i < 5) expect(value).toContain(`computed_${i}`)
        }
        const secondResolveTime = performance.now() - secondResolveStart

        // Factory should not have been called again
        expect(factoryCallCount).toBe(dependencyCount)

        console.log(`First resolve (with factory calls): ${firstResolveTime.toFixed(2)}ms`)
        console.log(`Second resolve (cached): ${secondResolveTime.toFixed(2)}ms`)
        console.log(`Cache speedup: ${(firstResolveTime / secondResolveTime).toFixed(1)}x`)

        // Performance requirements
        expect(firstResolveTime / secondResolveTime).toBeGreaterThan(10) // >10x speedup
        expect(secondResolveTime).toBeLessThan(5) // <5ms for cached resolution
    })

    /**
     * Test deep dependency chain performance
     */
    it('should handle deep dependency chains efficiently', () => {
        const depths = [100, 500, 1000]

        for (const depth of depths) {
            type ChainScope = Record<string, string>
            const context = new Context<ChainScope>()

            // Create dependency chain
            console.time(`Create ${depth}-level dependency chain`)
            context.registerValue('dep_0' as keyof ChainScope, 'base_value')

            for (let i = 1; i < depth; i++) {
                context.registerFactory(
                    `dep_${i}` as keyof ChainScope,
                    (prevValue: string) => `${prevValue}_chain_${i}`,
                    [`dep_${i - 1}`] as any,
                )
            }
            console.timeEnd(`Create ${depth}-level dependency chain`)

            // Measure resolution time
            const startTime = performance.now()
            const finalValue = context.resolve(`dep_${depth - 1}` as keyof ChainScope)
            const endTime = performance.now()

            const timeMs = endTime - startTime
            console.log(`Depth ${depth} chain resolution: ${timeMs.toFixed(2)}ms`)

            // Verify correctness
            expect(finalValue).toContain('base_value')
            expect(finalValue).toContain(`chain_${depth - 1}`)

            // Performance requirements based on depth
            if (depth <= 100) {
                expect(timeMs).toBeLessThan(5) // < 5ms for chains up to 100
            } else if (depth <= 500) {
                expect(timeMs).toBeLessThan(15) // < 15ms for chains up to 500
            } else if (depth <= 1000) {
                expect(timeMs).toBeLessThan(30) // < 30ms for chains up to 1000
            }
        }
    })

    /**
     * Test concurrent async dependency resolution performance
     */
    it('should handle concurrent async dependencies efficiently', async () => {
        const concurrencyLevels = [50, 200, 500]

        for (const concurrency of concurrencyLevels) {
            type AsyncScope = Record<string, Promise<string>>
            const context = new Context<AsyncScope>()

            let resolveCallCount = 0

            // Register async factory dependencies
            console.time(`Register ${concurrency} async factories`)
            for (let i = 0; i < concurrency; i++) {
                context.registerAsyncFactory(
                    `async_${i}` as keyof AsyncScope,
                    async () => {
                        resolveCallCount++
                        // Simulate async work
                        await new Promise((resolve) => setTimeout(resolve, 1))
                        return `async_value_${i}`
                    },
                    [],
                    { singleton: true },
                )
            }
            console.timeEnd(`Register ${concurrency} async factories`)

            // Resolve all dependencies concurrently
            const startTime = performance.now()
            const promises: Promise<string>[] = []
            for (let i = 0; i < concurrency; i++) {
                promises.push(context.resolve(`async_${i}` as keyof AsyncScope))
            }

            const results = await Promise.all(promises)
            const endTime = performance.now()

            const timeMs = endTime - startTime
            const throughput = concurrency / (timeMs / 1000)

            console.log(`Concurrency ${concurrency}: ${timeMs.toFixed(2)}ms, ${throughput.toFixed(0)} ops/sec`)

            // Verify correctness
            expect(results.length).toBe(concurrency)
            expect(resolveCallCount).toBe(concurrency)
            for (let i = 0; i < Math.min(5, concurrency); i++) {
                expect(results[i]).toBe(`async_value_${i}`)
            }

            // Performance requirements
            const maxExpectedTime = concurrency * 1.5 + 20 // Allow for concurrency + overhead
            expect(timeMs).toBeLessThan(maxExpectedTime)
            if (concurrency <= 200) {
                expect(throughput).toBeGreaterThan(100) // >100 ops/sec
            }
        }
    })

    /**
     * Test context extension and cache invalidation performance
     */
    it('should efficiently extend contexts and handle cache invalidation', () => {
        const baseSizes = [1000, 3000, 5000]

        for (const baseSize of baseSizes) {
            type ExtensionScope = Record<string, string>

            // Create base context with many dependencies
            const baseContext = new Context<ExtensionScope>()
            console.time(`Create base context with ${baseSize} dependencies`)
            for (let i = 0; i < baseSize; i++) {
                baseContext.registerValue(`base_${i}` as keyof ExtensionScope, `base_value_${i}`)
            }
            console.timeEnd(`Create base context with ${baseSize} dependencies`)

            // Test context extension performance
            const extendStart = performance.now()
            const extendedContext = new Context<ExtensionScope>()
            extendedContext.extend(baseContext)
            const extendTime = performance.now() - extendStart

            console.log(`Context extension (${baseSize} deps): ${extendTime.toFixed(2)}ms`)

            // Add some overrides and test cache invalidation
            const overrideCount = Math.min(100, baseSize / 10)
            console.time(`Add ${overrideCount} overrides`)
            for (let i = 0; i < overrideCount; i++) {
                extendedContext.registerValue(`base_${i}` as keyof ExtensionScope, `override_value_${i}`)
            }
            console.timeEnd(`Add ${overrideCount} overrides`)

            // Test resolution performance
            const resolveStart = performance.now()
            for (let i = 0; i < Math.min(1000, baseSize); i++) {
                const value = extendedContext.resolve(`base_${i}` as keyof ExtensionScope)
                if (i < overrideCount) {
                    expect(value).toBe(`override_value_${i}`)
                } else {
                    expect(value).toBe(`base_value_${i}`)
                }
            }
            const resolveTime = performance.now() - resolveStart

            console.log(`Resolution after extension: ${resolveTime.toFixed(2)}ms`)

            // Performance requirements
            const timePerDependency = extendTime / baseSize
            expect(timePerDependency).toBeLessThan(0.01) // <0.01ms per dependency for extension
        }
    })

    /**
     * Test circular dependency resolution performance
     */
    it('should handle circular dependencies efficiently at scale', () => {
        const serviceCount = 100

        interface Service {
            id: number
            name: string
            next: Service
            getValue: () => string
        }
        type ServiceMap = Record<string, Service>
        const context = new Context<ServiceMap>()

        // Create circular dependency network
        console.time('Register circular dependency network')
        for (let i = 0; i < serviceCount; i++) {
            const currentService = `service_${i}` as keyof ServiceMap
            const nextService = `service_${(i + 1) % serviceCount}` as keyof ServiceMap

            context.registerFactory(
                currentService,
                (nextSvc: Service): Service => ({
                    id: i,
                    name: `service_${i}`,
                    next: nextSvc,
                    getValue: () => `Value from service_${i}`,
                }),
                [nextService] as any,
                { singleton: true },
            )
        }
        console.timeEnd('Register circular dependency network')

        // Resolve all services
        const resolveStart = performance.now()
        const services: Service[] = []
        for (let i = 0; i < serviceCount; i++) {
            services.push(context.resolve(`service_${i}` as keyof ServiceMap))
        }
        const resolveTime = performance.now() - resolveStart

        console.log(`Circular dependency resolution: ${resolveTime.toFixed(2)}ms`)

        // Verify circular references work
        for (let i = 0; i < Math.min(10, serviceCount); i++) {
            const service = services[i]
            expect(service.id).toBe(i)
            expect(service.name).toBe(`service_${i}`)
            expect(service.getValue()).toBe(`Value from service_${i}`)

            const nextIndex = (i + 1) % serviceCount
            expect(service.next.id).toBe(nextIndex)
        }

        // Performance requirement: should resolve quickly even with circular deps
        expect(resolveTime).toBeLessThan(10) // <10ms for 100 circular services
    })

    /**
     * Test memory efficiency and rapid context lifecycle
     */
    it('should maintain memory efficiency during rapid operations', () => {
        const iterations = 500
        const dependenciesPerContext = 100

        console.time('Rapid context lifecycle benchmark')

        // Test rapid context creation and destruction
        for (let i = 0; i < iterations; i++) {
            type RapidScope = Record<string, string>
            const context = new Context<RapidScope>()

            // Add dependencies
            for (let j = 0; j < dependenciesPerContext; j++) {
                context.registerValue(`dep_${j}` as keyof RapidScope, `context_${i}_value_${j}`)
            }

            // Resolve some dependencies
            for (let j = 0; j < 10; j++) {
                const value = context.resolve(`dep_${j}` as keyof RapidScope)
                if (i < 5) expect(value).toBe(`context_${i}_value_${j}`)
            }

            // Force garbage collection periodically if available
            if (i % 100 === 0 && global.gc) {
                global.gc()
            }
        }

        console.timeEnd('Rapid context lifecycle benchmark')

        // Force final garbage collection if available
        if (global.gc) {
            global.gc()
        }
    })

    /**
     * Test eager initialization performance
     */
    it('should handle eager initialization efficiently at scale', async () => {
        const eagerCount = 500

        type SyncScope = Record<string, string>
        type AsyncScope = Record<string, Promise<string>>

        const syncContext = new Context<SyncScope>()
        const asyncContext = new Context<AsyncScope>()

        let syncInitCount = 0
        let asyncInitCount = 0

        // Register eager dependencies
        console.time('Register eager dependencies')
        for (let i = 0; i < eagerCount; i++) {
            // Sync eager
            syncContext.registerFactory(
                `eager_sync_${i}` as keyof SyncScope,
                () => {
                    syncInitCount++
                    return `eager_sync_value_${i}`
                },
                [],
                { eager: true, singleton: true },
            )

            // Async eager
            asyncContext.registerAsyncFactory(
                `eager_async_${i}` as keyof AsyncScope,
                async () => {
                    asyncInitCount++
                    await new Promise((resolve) => setTimeout(resolve, 1))
                    return `eager_async_value_${i}`
                },
                [],
                { eager: true, singleton: true },
            )
        }
        console.timeEnd('Register eager dependencies')

        // Initialize all eager dependencies
        const initStart = performance.now()
        await Promise.all([syncContext.initializeEagerDependencies(), asyncContext.initializeEagerDependencies()])
        const initTime = performance.now() - initStart

        console.log(`Eager initialization: ${initTime.toFixed(2)}ms`)

        expect(syncInitCount).toBe(eagerCount)
        expect(asyncInitCount).toBe(eagerCount)

        // Subsequent resolutions should be instant (cached)
        const resolveStart = performance.now()
        for (let i = 0; i < Math.min(100, eagerCount); i++) {
            const syncValue = syncContext.resolve(`eager_sync_${i}` as keyof SyncScope)
            const asyncValue = await asyncContext.resolve(`eager_async_${i}` as keyof AsyncScope)
            if (i < 5) {
                expect(syncValue).toBe(`eager_sync_value_${i}`)
                expect(asyncValue).toBe(`eager_async_value_${i}`)
            }
        }
        const resolveTime = performance.now() - resolveStart

        console.log(`Cached eager resolution: ${resolveTime.toFixed(2)}ms`)

        // Counters should not have increased
        expect(syncInitCount).toBe(eagerCount)
        expect(asyncInitCount).toBe(eagerCount)

        // Performance requirement: cached resolution should be very fast
        expect(resolveTime).toBeLessThan(5)
    })
})
