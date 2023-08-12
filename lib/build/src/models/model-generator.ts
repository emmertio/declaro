import { type Model } from '@declaro/core'
import type { PluginConfig } from '..'

export type ModelConfig = {
    outputDirectory: string
    paths: string[]
    generators: IModelGenerator[]
}

export type IModelGenerator = {
    generateModels(models: Model[], config: PluginConfig): Promise<any>
}
