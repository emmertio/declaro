import { ResolvedConfig } from 'vite'
import { ModelConfig } from '../models/model-generator'
import { DeepPartial, PromiseOrValue } from '@declaro/core'
import { glob } from 'glob'
import fs from 'fs'
import { resolve } from 'path'

export type PluginConfig = {
    configFile?: string
    viteConfig?: ResolvedConfig
    models: ModelConfig
}

export type StaticConfig = DeepPartial<PluginConfig> & {
    viteConfig?: ResolvedConfig
}
export type DynamicConfig = () => PromiseOrValue<StaticConfig>
export type Config = StaticConfig | DynamicConfig

export type UserConfig = PromiseOrValue<DeepPartial<Config>>

// TODO: Refactor this into a class.

export async function loadConfigFromFile(
    filenames: string[] = ['./declaro.config.js', './declaro.config.ts'],
    importFn: (path: string) => Promise<any> = (path) => import(path),
): Promise<StaticConfig> {
    const configFiles = (await glob(filenames)) ?? []
    const configFile = configFiles[0] ?? './declaro.config.js'
    const configModule =
        fs.existsSync(configFile) && (await importFn(configFile))
    const config: Config = (await configModule?.default) ?? (await configModule)

    return await parseConfig(config)
}

export async function parseConfig(config: Config): Promise<StaticConfig> {
    if (typeof config === 'function') {
        return await config()
    } else {
        return config
    }
}

export type IConfigLoader = {
    config: PluginConfig
    load: () => Promise<PluginConfig>
}
