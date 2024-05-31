import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
import dts from 'vite-plugin-dts'
import { node } from './node-build'

const extensions = {
    es: 'mjs',
    cjs: 'cjs',
}

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'DeclaroBuild',
            formats: ['es', 'cjs'],
            fileName: (format) => `pkg.${extensions[format]}`,
        },
        write: true,
    },
    plugins: [
        node(),
        dts({
            entryRoot: resolve(__dirname, 'src'),
        }) as any,
    ],
    optimizeDeps: {
        include: ['src/**/*'],
    },
})
