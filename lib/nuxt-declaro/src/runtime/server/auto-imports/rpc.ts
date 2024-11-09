import { initTRPC } from '@trpc/server'

export const rpc = initTRPC.create()

export const rootRouter = rpc.router
