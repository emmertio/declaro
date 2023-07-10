import { Plugin } from 'vite'
import { injector } from './di_container'

export function declaro() {
    const plugin: Plugin = {
        name: 'declaro:dev',
        enforce: 'pre',
        async handleHotUpdate(ctx) {
            const fileManager = injector.resolve('FileManager')

            await fileManager.prepareFilesystem()
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
