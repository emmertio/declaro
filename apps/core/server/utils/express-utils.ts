import { NextFunction, Request, RequestHandler, Response } from 'express'

export function asyncHandler<T extends RequestHandler>(handler: T) {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            await handler(req, res, next)
        } catch (e: any) {
            console.error(e)
            res.status(e.status ?? 500).json({
                message: e.message ?? 'Internal Server Error',
            })
        }
    }
}
