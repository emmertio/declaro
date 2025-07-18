import { ModelSchema } from '@declaro/core'
import { sortArray, ZodModel } from '@declaro/zod'
import { z } from 'zod/v4'
import type {
    InferFilters,
    InferLookup,
    InferDetail,
    InferSummary,
    InferSort,
    InferInput,
    InferSearchResults,
    InferEntityMetadata,
} from '../../../shared/utils/schema-inference'

export const MockBookSchema = ModelSchema.create('Book')
    .read({
        detail: (h) =>
            new ZodModel(
                h.name,
                z.object({
                    id: z.number().int().positive(),
                    title: z.string().min(2).max(100),
                    author: z.string().min(2).max(100),
                    publishedDate: z.date(),
                }),
            ),
        lookup: (h) =>
            new ZodModel(
                h.name,
                z.object({
                    id: z.number().int().positive(),
                }),
            ),
    })
    .search({
        filters: (h) =>
            new ZodModel(
                h.name,
                z.object({
                    text: z.string().optional(),
                }),
            ),
        summary: (h) =>
            new ZodModel(
                h.name,
                z.object({
                    id: z.number().int().positive(),
                    title: z.string().min(2).max(100),
                    author: z.string().min(2).max(100),
                    publishedDate: z.date(),
                }),
            ),
        sort: (h) => new ZodModel(h.name, sortArray(['title', 'author'])),
    })
    .write({
        input: (h) =>
            new ZodModel(
                h.name,
                z.object({
                    id: z.number().int().positive().optional(),
                    title: z.string().min(2).max(100),
                    author: z.string().min(2).max(100),
                    publishedDate: z.date(),
                }),
            ),
    })
    .entity({
        primaryKey: 'id',
    })

export type MockBookFilters = InferFilters<typeof MockBookSchema>
export type MockBookLookup = InferLookup<typeof MockBookSchema>
export type MockBookDetail = InferDetail<typeof MockBookSchema>
export type MockBookSummary = InferSummary<typeof MockBookSchema>
export type MockBookSort = InferSort<typeof MockBookSchema>
export type MockBookInput = InferInput<typeof MockBookSchema>
export type MockBookSearchResults = InferSearchResults<typeof MockBookSchema>
export type MockBookEntityMetadata = InferEntityMetadata<typeof MockBookSchema>
