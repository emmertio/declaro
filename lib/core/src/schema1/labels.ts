import { capitalCase, camelCase, paramCase, pascalCase } from 'change-case'
import pluralize from 'pluralize'

export type EntityLabels = {
    singularLabel?: string
    pluralLabel?: string
    singularParameter?: string
    pluralParameter?: string
    singularSlug?: string
    pluralSlug?: string
    singularEntityName?: string
    pluralEntityName?: string
    singularTableName?: string
    pluralTableName?: string
}

export function getEntityLabels(entity: string, labels: Partial<EntityLabels> = {}): EntityLabels {
    return {
        singularLabel: labels.singularLabel ?? capitalCase(pluralize(entity, 1)),
        pluralLabel: labels.pluralLabel ?? capitalCase(pluralize(entity, 10)),
        singularParameter: labels.singularParameter ?? camelCase(pluralize(entity, 1)),
        pluralParameter: labels.pluralParameter ?? camelCase(pluralize(entity, 10)),
        singularSlug: labels.singularSlug ?? paramCase(pluralize(entity, 1)),
        pluralSlug: labels.pluralSlug ?? paramCase(pluralize(entity, 10)),
        singularEntityName: labels.singularEntityName ?? pascalCase(pluralize(entity, 1)),
        pluralEntityName: labels.pluralEntityName ?? pascalCase(pluralize(entity, 10)),
        singularTableName: labels.singularTableName ?? paramCase(pluralize(entity, 1)),
        pluralTableName: labels.pluralTableName ?? paramCase(pluralize(entity, 10)),
    }
}
