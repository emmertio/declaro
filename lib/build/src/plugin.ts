import { Plugin } from 'vite'
import { injector } from './di_container'

export function declaro() {
    const plugin: Plugin = {
        name: 'declaro:dev',
        enforce: 'pre',
        async handleHotUpdate(ctx) {
            console.log('Hot update')
            const fileManager = injector.resolve('FileManager')

            await fileManager.prepareFilesystem()

            if (
                fileManager.pathMatches(ctx.file, [
                    'src/models/*.ts',
                    '**/*.model.ts',
                ])
            ) {
                // TODO: make these globs configurable
                const mod = await ctx.server.ssrLoadModule(ctx.file)
                const modelManager = injector.resolve('ModelManager')
                await modelManager.generateModelsForModule(mod)
            }
        },
        configResolved(config) {
            const pluginConfig = injector.resolve('PluginConfig')
            pluginConfig.viteConfig = config
        },
        async buildStart(ctx) {
            const pluginConfig = injector.resolve('PluginConfig')
            const fileManager = injector.resolve('FileManager')

            await fileManager.prepareFilesystem()
        },
    }

    return [plugin]
}
