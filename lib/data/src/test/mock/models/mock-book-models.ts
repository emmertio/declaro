import { ModelSchema } from '@declaro/core'
import { sortArray, ZodModel } from '@declaro/zod'
import { z } from 'zod/v4'

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
