import { z } from 'zod'
import { publicProcedure, router } from '../trpc/config'
import { PostSchema } from '../domain/post/post-model'
import { container } from '../di'

const postService = container.resolve('PostService')

export const postRouter = router({
    list: publicProcedure.output(z.array(PostSchema)).query(() => {
        const posts = postService.getPosts()

        return posts
    }),
})
