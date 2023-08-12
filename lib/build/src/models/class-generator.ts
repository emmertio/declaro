import { type Model } from '@declaro/core'
import { TypescriptMap } from '../utils/supported-types'
import { type IModelGenerator, type ModelConfig } from './model-generator'
import fs from 'fs'
import { resolve } from 'path'
import { pascalCase } from 'change-case'
import type { PluginConfig } from '..'

export class ClassModelGenerator implements IModelGenerator {
    async generateModels(models: Model[], options: PluginConfig) {
        await Promise.all(
            models.map(async (model) => {
                const outputFile = resolve(
                    '.declaro',
                    options.models?.outputDirectory,
                    `${pascalCase(model.name)}.ts`,
                )

                const source = [
                    `export class ${model.name} {`,
                    ...Object.entries(model.schema.properties)
                        .map(([name, prop]) => {
                            const type = prop['type']
                            const tsType = TypescriptMap[type]
                            if (typeof prop['type'] === 'string') {
                                return `    ${name}: ${tsType};`
                            } else {
                                return undefined
                            }
                        })
                        .filter(Boolean),
                    '}',
                ].join('\n')

                await new Promise((resolve, reject) => {
                    fs.writeFile(outputFile, source, (err) => {
                        if (err) {
                            reject(err)
                        } else {
                            resolve(undefined)
                        }
                    })
                })
            }),
        )
    }
}
