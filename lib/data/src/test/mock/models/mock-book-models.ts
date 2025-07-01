import { ModelSchema } from '@declaro/core'
import { ZodModel } from '@declaro/zod'
import { z } from 'zod/v4'

export const MockBookSchema = ModelSchema.create('Book')
    .read({
        detail: (h) =>
            new ZodModel(
                h.name,
                z.object({
                    id: z.string(),
                    title: z.string().min(2).max(100),
                    author: z.string().min(2).max(100),
                    publishedDate: z.date(),
                }),
            ),
        lookup: (h) =>
            new ZodModel(
                h.name,
                z.object({
                    id: z.string(),
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
                    id: z.string(),
                    title: z.string().min(2).max(100),
                    author: z.string().min(2).max(100),
                    publishedDate: z.date(),
                }),
            ),
    })
    .write({
        input: (h) =>
            new ZodModel(
                h.name,
                z.object({
                    id: z.string().optional(),
                    title: z.string().min(2).max(100),
                    author: z.string().min(2).max(100),
                    publishedDate: z.date(),
                }),
            ),
    })
