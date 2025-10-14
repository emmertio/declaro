# Context Dependency Injection Performance Tests

This directory contains comprehensive performance tests for the Declaro Context dependency injection system to ensure it remains performant at scale.

## Test Suite

### Performance Tests (`context.performance.test.ts`)

This unified test suite both demonstrates performance capabilities and enforces specific performance requirements that will fail if the system degrades beyond acceptable limits. The tests cover:

#### Core Performance Areas

-   **Large Dependency Resolution**: Tests with up to 10,000 simple dependencies with scaling analysis
-   **Singleton Caching**: Tests with 2,000+ expensive singleton factories demonstrating >10x cache speedup
-   **Deep Dependency Chains**: Tests with chains up to 1,000 levels deep with performance thresholds
-   **Concurrent Async Resolution**: Tests with up to 500 concurrent async operations
-   **Context Extension**: Tests extending contexts with up to 5,000 dependencies
-   **Circular Dependencies**: Tests with 100+ circular dependency networks
-   **Memory Efficiency**: Tests rapid context creation/destruction (500 contexts)
-   **Eager Initialization**: Tests with 500+ eager dependencies (sync and async)

## Performance Requirements

The tests enforce these specific performance requirements:

### Resolution Performance

-   Simple dependency resolution: <0.001ms per dependency for large sets (>5000)
-   Simple dependency resolution: <0.002ms per dependency for smaller sets (<5000)
-   Deep dependency chains (100 levels): <5ms total resolution time
-   Deep dependency chains (500 levels): <15ms total resolution time
-   Deep dependency chains (1000 levels): <30ms total resolution time

### Caching Performance

-   Singleton cache speedup: >10x faster than initial resolution
-   Cached resolution: <5ms for 2000 dependencies

### Async Performance

-   Concurrent async resolution: Should resolve in parallel, not sequentially
-   Throughput: >100 operations/second for reasonable concurrency levels (<200)

### Context Operations

-   Context extension: <0.01ms per dependency being extended
-   Circular dependency resolution: <10ms for 100 circular services

### Memory Efficiency

-   Cached eager resolution: <5ms
-   No significant memory leaks during rapid context lifecycle operations

## Key Features Tested

### Redundancy Elimination

The consolidated test suite eliminates previous redundancy by:

-   **Combining demonstration and benchmark testing** in single tests
-   **Multi-scale testing** within individual test cases (testing multiple sizes/depths)
-   **Shared test patterns** reducing duplicate setup code
-   **Focused verification** checking correctness on subset of data rather than all items
-   **Consolidated timing measurements** with both demonstration and requirement validation

### Performance Monitoring

Tests include detailed timing outputs for performance trend monitoring:

```
Resolution time for 10000 dependencies: 5.05ms
Cache speedup: 344.4x
Concurrency 500: 2.23ms, 223759 ops/sec
Context extension (5000 deps): 0.52ms
Circular dependency resolution: 1.82ms
```

## Running the Tests

```bash
# Run comprehensive performance tests
bun test context.performance

# Run all context tests including performance
bun test context
```

## Performance Analysis

Based on test results, the Context dependency injection system demonstrates:

-   **Linear scaling**: Resolution time scales linearly with dependency count
-   **Excellent caching**: 200-300x speedup with singleton caching
-   **High async throughput**: 200,000+ operations per second
-   **Efficient context operations**: Sub-millisecond extension times
-   **Robust circular dependency handling**: Proxy-based resolution with minimal overhead

## Recommendations for Scale

The performance tests validate that the Context dependency injection system is suitable for:

-   Applications with thousands of registered dependencies
-   Deep dependency hierarchies (hundreds of levels)
-   High-concurrency async dependency resolution
-   Frequent context creation/extension scenarios
-   Complex dependency graphs with circular references

The system's singleton caching, efficient proxy-based circular dependency handling, and optimized resolution algorithms ensure consistent performance at enterprise scale.
