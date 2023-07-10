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
            name: 'Declaro',
            formats: ['es', 'cjs'],
            fileName: (format) => `pkg.${extensions[format]}`,
        },
    },
    plugins: [node(), dts()],
    optimizeDeps: {
        include: ['src/**/*'],
    },
})
