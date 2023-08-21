import { RelationFormat, getReferenceType, type Model } from '@declaro/core'
import type { DeclaroSchema } from '@declaro/core/dist/schema/types'
import { pascalCase } from 'change-case'
import fs from 'fs'
import { resolve } from 'path'
import type { PluginConfig } from '../config/plugin-config'
import { TypescriptMap } from '../utils/supported-types'
import { type IModelGenerator } from './model-generator'

export function formatClassName(name: string) {
    return pascalCase(name) + 'DTO'
}

export function formatClassPath(name: string, options: PluginConfig) {
    return resolve(
        options.declaroDirectory,
        options.models?.outputDirectory,
        `${formatClassName(name)}.ts`,
    )
}

export class ClassModelGenerator implements IModelGenerator {
    async generateModels(models: Model[], options: PluginConfig) {
        await Promise.all(
            models.map(async (model) => {
                const outputFile = formatClassPath(model.name, options)

                const imports: string[] = []
                const modelName = formatClassName(model.name)

                const modelSource = [
                    `export class ${modelName} {`,
                    ...Object.entries(model.schema.properties)
                        .map(([name, prop]) => {
                            const type = prop['type']
                            const tsType = TypescriptMap[type]
                            const ref = (prop as DeclaroSchema.ReferenceObject)
                                .$ref
                            const refModel = models.find((m) => m.name === ref)
                            if (!!ref && !refModel) {
                                throw new Error(
                                    `Could not find model ${ref} referenced by ${modelName}.${name}`,
                                )
                            }
                            if (typeof ref === 'string') {
                                const relationName = formatClassName(
                                    refModel.name,
                                )
                                imports.push(
                                    `import { ${relationName} } from './${relationName}'`,
                                )
                                const relationType = getReferenceType(
                                    prop.format ?? RelationFormat.ManyToMany,
                                )
                                if (!relationType) {
                                    throw new Error(
                                        `Could not find relation type for ${prop.format}`,
                                    )
                                }

                                if (relationType === 'object') {
                                    return `    ${name}: ${relationName} = new ${relationName}()`
                                } else {
                                    return `    ${name}: ${relationName}[] = []`
                                }
                            } else if (typeof prop['type'] === 'string') {
                                return `    ${name}: ${tsType};`
                            } else {
                                return undefined
                            }
                        })
                        .filter(Boolean),
                    '}',
                ].join('\n')

                const source = [imports.join('\n'), modelSource].join('\n\n')

                await new Promise((resolve, reject) => {
                    fs.writeFile(outputFile, source, (err) => {
                        if (err) {
                            reject(err)
                        } else {
                            resolve(undefined)
                        }
                    })
                }).catch((err) => {
                    console.error(`Failed to write ${outputFile}`)
                    throw err
                })
            }),
        )
    }
}
