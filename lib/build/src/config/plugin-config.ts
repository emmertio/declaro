import { ResolvedConfig } from 'vite'
import { IModelGenerator } from '../models/model-generator'
import { ClassModelGenerator } from '../models/class-generator'

export class PluginConfig {
    viteConfig: ResolvedConfig
    modelGenerator: IModelGenerator = new ClassModelGenerator() // TODO: make this configurable
}
