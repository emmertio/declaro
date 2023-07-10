import { Model } from '@declaro/core'
import { IModelGenerator } from './model-generator'
import { PluginConfig } from '../config/plugin-config'
import { ClassModelGenerator } from './class-generator'
import fs from 'fs'
import { resolve } from 'path'
import { pascalCase } from 'change-case'

export class ModelManager {
    static inject = ['PluginConfig'] as const

    protected readonly modelGenerator: IModelGenerator
    protected readonly modelDirectory: string

    constructor(protected readonly config: PluginConfig) {
        this.modelGenerator = config.modelGenerator ?? new ClassModelGenerator()
        this.modelDirectory = resolve(config.viteConfig.root, '.declaro/models')
    }

    async generateModelsForModule(module: Record<string, any>) {
        console.log('Generating models for module', module)
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

        console.log('Found models', models)

        const modelMeta = await Promise.all(
            models.map(async (model) => {
                return {
                    name: model.name,
                    model: model,
                    source: await this.modelGenerator.generateModel(model),
                }
            }),
        )

        await Promise.all(
            modelMeta.map(async (model) => {
                const outputFile = resolve(
                    this.modelDirectory,
                    `${pascalCase(model.name)}.ts`,
                )
                fs.writeFileSync(outputFile, model.source)
            }),
        )
    }
}
