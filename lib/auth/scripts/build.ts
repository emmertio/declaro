import { build } from 'bun'
import { resolve } from 'path'

const defaults = {
    entrypoints: [resolve(__dirname, '../src/index.ts')],
}

await Promise.all([
    build({
        ...defaults,
        target: 'node',
        format: 'cjs',
        splitting: true,
        outdir: 'dist/node',
        sourcemap: 'linked',
        naming: '[dir]/[name].cjs',
        external: ['crypto', 'node:crypto'],
    }),
    build({
        ...defaults,
        target: 'node',
        format: 'esm',
        splitting: true,
        outdir: 'dist/node',
        sourcemap: 'linked',
        naming: '[dir]/[name].js',
        external: ['crypto', 'node:crypto'],
    }),
    build({
        ...defaults,
        target: 'browser',
        outdir: 'dist/browser',
        sourcemap: 'linked',
        minify: true,
        external: ['crypto', 'node:crypto'], // We will polyfill this ourselves
    }),
])
