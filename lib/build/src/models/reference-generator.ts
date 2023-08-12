import { pascalCase } from 'change-case'
import type { IModelGenerator, PluginConfig } from '..'
import { resolve } from 'path'
import fs from 'fs'
import type { Model } from '@declaro/core'

export class ReferenceGenerator implements IModelGenerator {
    async generateModels(models: Model[], options: PluginConfig) {
        const outputFile = resolve(
            options.declaroDirectory,
            options.models?.outputDirectory,
            `reference.ts`,
        )

        const entityNames = models
            .map((model) => {
                return `'${pascalCase(model.name)}'`
            })
            .join(' | ')

        const source = [`export type ModelNames = ${entityNames}`].join('\n\n')

        await new Promise((resolve, reject) => {
            fs.writeFile(outputFile, source, (err) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(undefined)
                }
            })
        })
    }
}
