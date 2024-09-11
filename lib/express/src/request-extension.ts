import { defer, defineExtension } from '@declaro/di'
import type { Request } from 'express'

export const httpRequestExtension = (req: Request) =>
    defineExtension((container) => {
        return container
            .provideValue('Express.Request', req)
            .provideFactory('Http.Headers', (req: Request) => req.headers, ['Express.Request'])
            .provideFactory('Http.Query', (req: Request) => req.query, ['Express.Request'])
            .provideFactory('Http.Params', (req: Request) => req.params, ['Express.Request'])
    })
