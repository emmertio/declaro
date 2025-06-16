import { Type, Module, Pick } from '@sinclair/typebox'

export interface EntitySchema<T> {
    entity: T
}

const Book = Type.Object({
    id: Type.Integer(),
    title: Type.String(),
    year: Type.Number(),
})

const BookInput = Type.Intersect([
    Book,
    Type.Object({
        id: Type.Optional(Type.Integer()),
    }),
])

const BookSchema = Module({
    Entity: Book,
    Lookup: Pick(Book, ['id']),
    Filter: Pick(Book, ['title', 'year']),
    Input: BookInput,
    Ref: Type.Ref('Book'),
})
