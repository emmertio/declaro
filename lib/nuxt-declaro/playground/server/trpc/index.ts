import { postRouter } from '../application/post-router'
import { router } from './config'

export const appRouter = router({
    post: postRouter,
})

export type AppRouter = typeof appRouter
