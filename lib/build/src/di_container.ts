import { createInjector } from 'typed-inject'
import { FileConfigLoader } from './config/config-loader'
import { IConfigLoader } from './config/plugin-config'
import { FileManager } from './filesystem/file-manager'
import { ModelManager } from './models/model-manager'

export type IBaseInjector = typeof baseInjector

export const baseInjector = createInjector().provideValue(
    'ConfigLoader',
    new FileConfigLoader({
        // File config loader options
    }) as IConfigLoader,
)

/**
 * Get an injector for the Declaro build environment
 * @param extendInjector Optionally provide an injector to extend, instead of baseInjector.
 * @returns A fully configured injector
 */
export async function getInjector<T extends IBaseInjector>(
    extendInjector: T = baseInjector as T,
) {
    const configLoader = extendInjector.resolve('ConfigLoader')

    const config = await configLoader.load()

    const injector = extendInjector
        .provideValue('PluginConfig', config)
        .provideClass('FileManager', FileManager)
        .provideClass('ModelManager', ModelManager)

    return injector
}
