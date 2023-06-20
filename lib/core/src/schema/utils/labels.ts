import { capitalCase, camelCase, paramCase, pascalCase } from 'change-case'
import pluralize from 'pluralize'

export type EntityLabels = {
    singularLabel: string
    pluralLabel: string
    singularParameter: string
    pluralParameter: string
    singularSlug: string
    pluralSlug: string
    singularEntityName: string
    pluralEntityName: string
}

export function setLabels(
    entity: string,
    labels: Partial<EntityLabels> = {},
): EntityLabels {
    return {
        singularLabel: capitalCase(
            pluralize(labels.singularLabel ?? entity, 1),
        ),
        pluralLabel: capitalCase(pluralize(labels.pluralLabel ?? entity, 10)),
        singularParameter: camelCase(
            pluralize(labels.singularParameter ?? entity, 1),
        ),
        pluralParameter: camelCase(
            pluralize(labels.pluralParameter ?? entity, 10),
        ),
        singularSlug: paramCase(pluralize(labels.singularSlug ?? entity, 1)),
        pluralSlug: paramCase(pluralize(labels.pluralSlug ?? entity, 10)),
        singularEntityName: pascalCase(
            pluralize(labels.singularEntityName ?? entity, 1),
        ),
        pluralEntityName: pascalCase(
            pluralize(labels.pluralEntityName ?? entity, 10),
        ),
    }
}
