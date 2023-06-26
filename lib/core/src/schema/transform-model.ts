import { Model } from '.'
import { TypescriptMap } from './supported-types'

export function transformModel(model: Model) {
    return {
        toTypescript() {
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
        },
    }
}
