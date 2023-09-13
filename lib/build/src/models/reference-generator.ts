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

        let entityNames = models
            .map((model) => {
                return `'${pascalCase(model.name)}'`
            })
            .join(' | ')

        if (entityNames.length === 0) {
            entityNames = 'string'
        }

        const declaroSchema = `export type ModelNames = ${entityNames}`

        const source = [declaroSchema].join('\n\n')

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
