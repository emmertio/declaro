import { merge } from '@declaro/core'
import {
    type Config,
    type IConfigLoader,
    type PluginConfig,
    type StaticConfig,
    loadConfigFromFile,
    parseConfig,
} from './plugin-config'

export type LoadConfig = {
    configFile: string[]
    config?: Config
    importFn: (path: string) => any
}
export type LoadOptions = Partial<LoadConfig>

export class FileConfigLoader implements IConfigLoader {
    public readonly config: PluginConfig = FileConfigLoader.getDefaultConfig()
    protected _loaded = false
    public get loaded() {
        return this._loaded
    }

    constructor(protected readonly options?: LoadOptions) {}

    static getDefaultLoadOptions(): LoadConfig {
        return {
            importFn: (path) => import(path),
            configFile: ['./declaro.config.js', './declaro.config-ts'],
        }
    }
    static getDefaultConfig(): PluginConfig {
        return {
            models: {
                outputDirectory: 'models',
                paths: ['**/*.model.ts', 'src/models/*.ts', '**/models/*.ts'],
                generators: [],
            },
        }
    }

    async load(): Promise<PluginConfig> {
        const loadConfig = {
            ...FileConfigLoader.getDefaultLoadOptions(),
            ...this.options,
        }

        const defaultConfig = FileConfigLoader.getDefaultConfig()
        const configFromArgs = await parseConfig(this.options.config)
        const configFromFile = await loadConfigFromFile(loadConfig.configFile)

        merge(this.config, defaultConfig, configFromArgs)

        return this.config
    }
}
