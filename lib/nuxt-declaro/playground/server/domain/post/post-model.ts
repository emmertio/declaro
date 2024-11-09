import { z } from 'zod'

export const PostSchema = z.object({
    id: z.number(),
    title: z.string(),
    content: z.string(),
})

export type Post = z.infer<typeof PostSchema>
