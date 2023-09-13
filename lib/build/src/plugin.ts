import { type Plugin, type PluginOption } from 'vite'
import { FileConfigLoader } from './config/config-loader'
import { type Config, type IConfigLoader } from './config/plugin-config'
import { baseInjector, getInjector } from './di_container'

export async function declaro(options?: Config): Promise<any> {
    const customInjector = baseInjector.provideValue(
        'ConfigLoader',
        new FileConfigLoader({
            config: options,
        }) as IConfigLoader,
    )

    const injector = await getInjector(customInjector)

    const pluginConfig = injector.resolve('PluginConfig')

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
                const modelManager = injector.resolve('ModelManager')
                const models = await modelManager.scanModels(
                    pluginConfig.models.paths ?? [],
                    (path) => ctx.server.ssrLoadModule(path),
                )
                console.log('Found models', models)
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
            await modelManager.generateModels(models)
        },
    }

    return [plugin]
}
