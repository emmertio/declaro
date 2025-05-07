export enum RelationFormat {
    OneToOne = 'one-to-one',
    OneToMany = 'one-to-many',
    ManyToOne = 'many-to-one',
    ManyToMany = 'many-to-many',
    EmbeddedObject = 'embedded-object',
    EmbeddedArray = 'embedded-array',
}

export type RelationReferenceType = 'object' | 'array'

export function getReferenceType(format: string): RelationReferenceType {
    switch (format) {
        case RelationFormat.OneToOne:
        case RelationFormat.ManyToOne:
        case RelationFormat.EmbeddedObject:
            return 'object'
        case RelationFormat.OneToMany:
        case RelationFormat.ManyToMany:
        case RelationFormat.EmbeddedArray:
            return 'array'
    }
}
