import { Model } from '@declaro/core'
import { TypescriptMap } from '../utils/supported-types'
import { IModelGenerator } from './model-generator'
import fs from 'fs'

export class ClassModelGenerator implements IModelGenerator {
    async generateModel(model: Model) {
        return [
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
    }
}
