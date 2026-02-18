import { build, type BunPlugin } from 'bun'
import { resolve } from 'path'
import packageJson from '../package.json'

/**
 * Get all packages that should be external from dependencies, peerDependencies, and optionalDependencies
 * Packages in devDependencies will be bundled
 */
const getExternalPackages = (): string[] => {
    const pkg = packageJson as any
    const dependencyKeys: string[] = []

    // Add dependencies if they exist
    if (pkg.dependencies && typeof pkg.dependencies === 'object') {
        dependencyKeys.push(...Object.keys(pkg.dependencies))
    }

    // Add peerDependencies if they exist
    if (pkg.peerDependencies && typeof pkg.peerDependencies === 'object') {
        dependencyKeys.push(...Object.keys(pkg.peerDependencies))
    }

    // Add optionalDependencies if they exist
    if (pkg.optionalDependencies && typeof pkg.optionalDependencies === 'object') {
        dependencyKeys.push(...Object.keys(pkg.optionalDependencies))
    }

    // Remove duplicates and return
    return [...new Set(dependencyKeys)]
}

const externalPackages = getExternalPackages()

const shimAsyncHooks: BunPlugin = {
    name: 'shim-async-hooks',
    setup(build) {
        build.onResolve({ filter: /^node:async_hooks$|^async_hooks$/ }, () => ({
            path: resolve(__dirname, '../src/shims/async-local-storage.ts'),
        }))
    },
}

const defaults = {
    entrypoints: [resolve(__dirname, '../src/index.ts'), resolve(__dirname, '../src/scope/index.ts')],
}

await Promise.all([
    // CommonJS build for Node.js - externalize all dependencies and peerDependencies
    build({
        ...defaults,
        target: 'node',
        format: 'cjs',
        outdir: 'dist/node',
        sourcemap: 'linked',
        naming: '[dir]/[name].cjs',
        external: externalPackages,
    }),
    // ES modules build for Node.js - same externals as CommonJS
    build({
        ...defaults,
        target: 'node',
        format: 'esm',
        outdir: 'dist/node',
        sourcemap: 'linked',
        naming: '[dir]/[name].js',
        external: externalPackages,
    }),
    // Browser build - shim node:async_hooks with synchronous polyfill
    build({
        ...defaults,
        target: 'browser',
        outdir: 'dist/browser',
        sourcemap: 'linked',
        minify: true,
        external: externalPackages,
        plugins: [shimAsyncHooks],
    }),
])
