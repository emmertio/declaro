import { Module } from '@declaro/core'
import type { DeclaroSchema } from '@declaro/core/dist/schema/types'
import { type Request, type Response, type NextFunction } from 'express'
import { Endpoint } from './endpoint'

export type RequestContextFactory<TContext, TExistingContext = any> = (req: Request, context: TExistingContext) => TContext

export class ExpressComposer<TContext> {
    constructor(
        protected readonly module: Module,
        protected readonly contextFactory: RequestContextFactory<TContext>,
    ) {}

    endpoint(info: DeclaroSchema.OperationObject) {
        return Endpoint.create(this.module, info).context(this.contextFactory)
    }

    middleware() {
        return (req: Request, res: Response, next: NextFunction) => {
            const existingContext = (req as any).context as TContext
            return next()
        }
    }
}
