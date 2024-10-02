export interface IError {
    code: number
    message: string
    meta: any
}

export abstract class BaseError extends Error implements IError {
    public readonly meta: any
    public readonly code: number = 500

    constructor(message: string, meta?: any) {
        super(message)
        this.name = 'BaseError'
        this.meta = meta
    }

    public toJSON() {
        return {
            code: this.code,
            message: this.message,
            meta: this.meta,
        }
    }

    public toString() {
        return JSON.stringify(this.toJSON())
    }
}

export class SystemError extends BaseError {
    public readonly code: number = 500

    constructor(message: string, meta?: any) {
        super(message, meta)
        this.name = 'SystemError'
    }
}

export class ValidationError extends BaseError {
    public readonly code: number = 400

    constructor(message: string, meta?: any) {
        super(message, meta)
        this.name = 'ValidationError'
    }
}

export class NotFoundError extends BaseError {
    public readonly code: number = 404

    constructor(message: string, meta?: any) {
        super(message, meta)
        this.name = 'NotFoundError'
    }
}

export class UnauthorizedError extends BaseError {
    public readonly code: number = 401

    constructor(message: string, meta?: any) {
        super(message, meta)
        this.name = 'UnauthorizedError'
    }
}

export class ForbiddenError extends BaseError {
    public readonly code: number = 403

    constructor(message: string, meta?: any) {
        super(message, meta)
        this.name = 'ForbiddenError'
    }
}
