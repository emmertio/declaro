import {
    defineNuxtModule,
    addPlugin,
    createResolver,
    addServerHandler,
    addServerImportsDir,
    addServerImports,
} from '@nuxt/kit'
import { createHTTPHandler } from '@trpc/server/adapters/standalone'
import fs from 'fs'

// Module options TypeScript interface definition
export interface ModuleOptions {}

export default defineNuxtModule<ModuleOptions>({
    meta: {
        name: 'my-module',
        configKey: 'myModule',
    },
    // Default configuration options of the Nuxt module
    defaults: {},
    setup(_options, nuxt) {
        const resolver = createResolver(import.meta.url)
        const appResolver = createResolver(nuxt.options.rootDir)
        const trpcPath = appResolver.resolve('server/trpc')

        // Do not add the extension since the `.ts` will be transpiled to `.mjs` after `npm run prepack`
        addPlugin(resolver.resolve('./runtime/plugin'))

        addServerImportsDir([resolver.resolve('runtime/server/auto-imports')])

        addServerHandler({
            route: '/trpc',
            handler: resolver.resolve('runtime/server/server-handler'),
        })

        nuxt.hook('build:before', async () => {
            if (fs.existsSync(trpcPath)) {
                console.log('TRPC path exists:', trpcPath)
            } else {
                console.log('TRPC path does not exist:', trpcPath)
            }
        })

        nuxt.hook('builder:watch', (_event, _path) => {
            console.log('Builder watch:', _event, _path)
        })

        for (const layer of nuxt.options._layers) {
            console.log('Layer:', layer)
        }
    },
})
