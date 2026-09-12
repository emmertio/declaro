import { SystemError } from '../errors/errors'

/**
 * Base class for every error raised by the transaction framework.
 */
export class TransactionError extends SystemError {
    constructor(message: string, meta?: any) {
        super(message, meta)
        this.name = 'TransactionError'
    }
}

/**
 * Thrown when the manual API is used without an active transaction, or when
 * no adapter/manager could be resolved for the current async context.
 */
export class NoActiveTransactionError extends TransactionError {
    constructor(
        message = 'No active transaction was found. Start one with transaction.start() or run your code inside transaction(fn).',
        meta?: any,
    ) {
        super(message, meta)
        this.name = 'NoActiveTransactionError'
    }
}

/**
 * Thrown when a transaction that already committed or rolled back is
 * committed or rolled back again.
 */
export class InactiveTransactionError extends TransactionError {
    constructor(message: string, meta?: any) {
        super(message, meta)
        this.name = 'InactiveTransactionError'
    }
}

/**
 * Thrown when a transaction marked rollback-only is asked to commit. The
 * transaction is rolled back before this error is raised.
 */
export class TransactionRollbackError extends TransactionError {
    constructor(message = 'Transaction was marked rollback-only and could not be committed.', meta?: any) {
        super(message, meta)
        this.name = 'TransactionRollbackError'
    }
}
