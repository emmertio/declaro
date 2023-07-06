import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
import dts from 'vite-plugin-dts'

const extensions = {
    es: 'mjs',
    cjs: 'cjs',
}

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'DeclaroDB',
            formats: ['es', 'cjs'],
            fileName: (format) => `declaro-db.${extensions[format]}`,
        },
    },
    plugins: [dts()],
    optimizeDeps: {
        include: ['src/**/*'],
    },
})
