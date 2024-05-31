import { getReferenceType, TypescriptMap, type Model } from '@declaro/core'
import type { PluginConfig } from '../config/plugin-config'
import path from 'path'
import type { IModelGenerator } from '../models/model-generator'
import { pascalCase } from 'change-case'
import fs from 'fs'

export function formatInterfacePath(name: string, options: PluginConfig) {
    return path.join(options.declaroDirectory, options.models?.outputDirectory, `${formatInterfaceName(name)}.ts`)
}

export function formatInterfaceName(name: string) {
    return pascalCase('I' + name)
}

export class InterfaceModelGenerator implements IModelGenerator {
    async generateModels(models: Model[], options: PluginConfig) {
        await Promise.all(
            models.map(async (model) => {
                const outputFile = formatInterfacePath(model.name, options)

                const imports: string[] = []
                const modelName = formatInterfaceName(model.name)

                const modelSource = [
                    `export interface ${modelName} {`,
                    ...Object.entries(model.schema.properties)
                        .map(([name, prop]) => {
                            const type = prop['type']
                            const tsType = TypescriptMap[type]
                            const ref = (prop as any).$ref
                            const refModel = models.find((m) => m.name === ref)
                            if (!!ref && !refModel) {
                                throw new Error(`Could not find model ${ref} referenced by ${modelName}.${name}`)
                            }
                            if (typeof ref === 'string') {
                                const relationName = formatInterfaceName(refModel.name)
                                imports.push(`import { type ${relationName} } from './${relationName}'`)

                                const relationType = getReferenceType(prop.format)

                                if (!relationType) {
                                    throw new Error(`Could not find relation type for ${prop.format}`)
                                }

                                if (relationType === 'array') {
                                    return `    ${name}: ${relationName}[];`
                                } else {
                                    return `    ${name}: ${relationName};`
                                }
                            } else if (typeof prop['type'] === 'string') {
                                return `    ${name}: ${tsType};`
                            } else {
                                return undefined
                            }
                        })
                        .filter(Boolean),
                    `}`,
                ].join('\n')

                const source = [imports.join('\n'), modelSource].join('\n\n')

                await new Promise((resolve, reject) => {
                    fs.writeFile(outputFile, source, (err) => {
                        if (err) {
                            reject(err)
                        } else {
                            resolve(null)
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
