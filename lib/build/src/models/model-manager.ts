import { type Model } from '@declaro/core'
import { glob } from 'glob'
import { resolve } from 'path'
import { type PluginConfig } from '../config/plugin-config'
import { type IModelGenerator } from './model-generator'

export class ModelManager {
    static inject = ['PluginConfig'] as const

    protected readonly modelGenerators: IModelGenerator[]
    protected readonly modelDirectory: string
    protected readonly models: Map<string, Model> = new Map()

    constructor(protected readonly config: PluginConfig) {
        this.modelDirectory = resolve(config.viteConfig.root, '.declaro/models')
        this.modelGenerators = config?.models?.generators ?? []
    }

    async scanModels(
        paths: string[],
        importFn: (path: string) => Promise<any>,
    ) {
        const files = await glob(paths)

        const scan = (
            await Promise.all(
                files?.map(async (file) => {
                    const module = await importFn(file)
                    return this.scanModuleForModels(module)
                }),
            )
        ).flat()

        return scan
    }

    async scanModuleForModels(module: Record<string, any>) {
        const models: Model[] = []

        if (module?.isModel) {
            models.push(module as Model)
        }

        if (module?.default?.isModel) {
            models.push(module.default as Model)
        }

        for (const [name, model] of Object.entries(module)) {
            if (model.isModel) {
                models.push(model)
            }
        }

        models.forEach((model) => {
            this.models.set(model.name, model)
        })

        return models
    }

    async generateModels(models: Model[]) {
        await Promise.all(
            this.modelGenerators.map(async (generator) => {
                await generator.generateModels(models, this.config)
            }),
        )
    }
}
