import { Plugin } from 'vite'
import {
    Config,
    IConfigLoader,
    UserConfig,
    parseConfig,
} from './config/plugin-config'
import { baseInjector, getInjector } from './di_container'
import { createInjector } from 'typed-inject'
import { FileConfigLoader } from './config/config-loader'

export async function declaro(options?: Config) {
    const customInjector = baseInjector.provideValue(
        'ConfigLoader',
        new FileConfigLoader({
            config: options,
        }) as IConfigLoader,
    )

    const injector = await getInjector(customInjector)

    const pluginConfig = injector.resolve('PluginConfig')
    console.log('Config', pluginConfig)

    const plugin: Plugin = {
        name: 'declaro:dev',
        enforce: 'pre',
        async handleHotUpdate(ctx) {
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
                const models = await modelManager.scanModuleForModels(mod)
                await modelManager.generateModels(models)
            }
        },
        async configResolved(config) {
            pluginConfig.viteConfig = config
        },
        async configureServer(server) {
            const fileManager = injector.resolve('FileManager')

            await fileManager.prepareFilesystem()

            const modelManager = injector.resolve('ModelManager')

            const models = await modelManager.scanModels(
                pluginConfig.models.paths ?? [],
                (path) => server.ssrLoadModule(path),
            )
            console.log('Found models', models)
            await modelManager.generateModels(models)
        },
    }

    return [plugin]
}
