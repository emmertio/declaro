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

const defaults = {
    entrypoints: [resolve(__dirname, '../src/index.ts')],
}

/**
 * The Bun testing entry (`@declaro/data/testing/bun`). Node builds only: it imports `bun:test`, so there's no browser
 * build of it.
 */
const bunTestingDefaults = {
    entrypoints: [resolve(__dirname, '../src/testing/bun.ts')],
    target: 'node' as const,
    outdir: 'dist/node/testing',
    sourcemap: 'linked' as const,
    external: [...externalPackages, packageJson.name, 'bun:test'],
    plugins: [mainEntryAsPackage()],
}

/**
 * Resolves the testing entry's imports of the main entry (`../index`) to the external `@declaro/data`, so the testing
 * bundle shares the main entry's code (one `Transaction`, one `TransactionStack`) instead of bundling its own copy.
 */
function mainEntryAsPackage(): BunPlugin {
    return {
        name: 'main-entry-as-package',
        setup(builder) {
            // Bun ignores a rewritten `path` on an external resolve, so route the import through a virtual module that
            // re-exports the main entry's runtime exports from the package, which is external.
            builder.onResolve({ filter: /^\.\.\/index$/ }, () => ({ path: 'index', namespace: 'main-entry' }))
            builder.onLoad({ filter: /.*/, namespace: 'main-entry' }, async () => {
                const names = Object.keys(await import('../src/index.ts'))
                return { contents: `export { ${names.join(', ')} } from '${packageJson.name}'`, loader: 'js' }
            })
        },
    }
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
    // Browser build - same external behavior for consistency
    build({
        ...defaults,
        target: 'browser',
        outdir: 'dist/browser',
        sourcemap: 'linked',
        minify: true,
        external: externalPackages,
    }),
    // Bun testing entry, CommonJS and ES modules
    build({
        ...bunTestingDefaults,
        format: 'cjs',
        naming: '[name].cjs',
    }),
    build({
        ...bunTestingDefaults,
        format: 'esm',
        naming: '[name].js',
    }),
])
