import { capitalCase, camelCase, paramCase, pascalCase, sentenceCase } from 'change-case'
import pluralize from 'pluralize'

export type ModelLabels = {
    singularLabel: string
    pluralLabel: string
    singularSentence: string
    pluralSentence: string
    singularParameter: string
    pluralParameter: string
    singularSlug: string
    pluralSlug: string
    singularEntityName: string
    pluralEntityName: string
}

export function getLabels(modelName: string, labels: Partial<ModelLabels> = {}): ModelLabels {
    return {
        singularLabel: capitalCase(pluralize(labels.singularLabel ?? modelName, 1)),
        pluralLabel: capitalCase(pluralize(labels.pluralLabel ?? modelName, 10)),
        singularSentence: sentenceCase(pluralize(labels.singularLabel ?? modelName, 1)),
        pluralSentence: sentenceCase(pluralize(labels.pluralLabel ?? modelName, 10)),
        singularParameter: camelCase(pluralize(labels.singularParameter ?? modelName, 1)),
        pluralParameter: camelCase(pluralize(labels.pluralParameter ?? modelName, 10)),
        singularSlug: paramCase(pluralize(labels.singularSlug ?? modelName, 1)),
        pluralSlug: paramCase(pluralize(labels.pluralSlug ?? modelName, 10)),
        singularEntityName: pascalCase(pluralize(labels.singularEntityName ?? modelName, 1)),
        pluralEntityName: pascalCase(pluralize(labels.pluralEntityName ?? modelName, 10)),
    }
}
