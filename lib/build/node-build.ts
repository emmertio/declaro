import { Plugin } from 'vite'
import { nodeExternals } from 'rollup-plugin-node-externals'
import MagicString from 'magic-string'

// Note: See https://dev.to/rxliuli/developing-and-building-nodejs-applications-with-vite-311n for more info

export function externals(): Plugin {
    return {
        ...nodeExternals(),
        name: 'node-externals',
        enforce: 'pre',
        apply: 'build',
    }
}

function shims(): Plugin {
    return {
        name: 'node-shims',
        renderChunk(code, chunk) {
            if (!chunk.fileName.endsWith('.js')) {
                return
            }
            // console.log('transform', chunk.fileName)
            const s = new MagicString(code)
            s.prepend(`
import __path from 'path'
import { fileURLToPath as __fileURLToPath } from 'url'
import { createRequire as __createRequire } from 'module'

const __getFilename = () => __fileURLToPath(import.meta.url)
const __getDirname = () => __path.dirname(__getFilename())
const __dirname = __getDirname()
const __filename = __getFilename()
const self = globalThis
const require = __createRequire(import.meta.url)
`)
            return {
                code: s.toString(),
                map: s.generateMap(),
            }
        },
        apply: 'build',
    }
}

export function node(): Plugin[] {
    return [shims(), externals()]
}
