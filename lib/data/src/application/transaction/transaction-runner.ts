import { Context, useContext, withContext } from '@declaro/core'
import {
    TransactionStatus,
    type ITransactionAdapter,
    type TransactionCallback,
} from '../../domain/transaction/transaction-adapter-interface'
import type { ITransactionScope } from '../../types/transaction-context'

/**
 * Runs callbacks inside transactions: begins the transaction, binds it to the ambient context, and commits on
 * success or rolls back on failure.
 *
 * Stateless, so one instance can be shared by any number of transactions.
 */
export class TransactionRunner {
    /**
     * Runs `callback` inside `transaction`.
     *
     * - A `Pending` transaction is begun, then committed when `callback` resolves or rolled back when it throws.
     * - An `Active` transaction runs `callback` in a new transaction nested inside it.
     * - If `callback` commits or rolls back the transaction itself, the runner leaves it alone.
     *
     * While `callback` runs, `useTransaction()` returns `transaction`, because it is registered on a child of
     * `context` that is bound with `withContext`.
     *
     * @param transaction - The transaction to run in.
     * @param callback - The work to run.
     * @param context - The context to derive the transaction's context from. Defaults to the ambient context.
     * @returns Whatever `callback` returns.
     * @throws {Error} If `transaction` has already been committed or rolled back.
     * @throws {AggregateError} If rolling back after a failure also fails. Holds both errors.
     */
    async run<TResult, TTransaction extends ITransactionAdapter>(
        transaction: TTransaction,
        callback: TransactionCallback<TResult, TTransaction>,
        context: Context | null = useContext(),
    ): Promise<TResult> {
        if (transaction.status === TransactionStatus.Active) {
            return this.run(transaction.nested() as TTransaction, callback, context)
        }

        if (transaction.status !== TransactionStatus.Pending) {
            throw new Error(`Cannot run a transaction that has already been ${transaction.status}`)
        }

        const transactionContext = new Context<ITransactionScope>()
        if (context) {
            transactionContext.extend(context)
        }
        transactionContext.registerValue('transaction', Promise.resolve(transaction))

        await transaction.begin()

        try {
            const result = await withContext(transactionContext, () => callback(transaction))

            if (isActive(transaction)) {
                await transaction.commit()
            }

            return result
        } catch (error) {
            if (isActive(transaction)) {
                try {
                    await transaction.rollback()
                } catch (rollbackError) {
                    throw new AggregateError([error, rollbackError], 'Transaction failed, and so did its rollback')
                }
            }

            throw error
        }
    }
}

/**
 * Reads the status fresh. The callback can change it, which TypeScript's narrowing doesn't know about.
 */
function isActive(transaction: ITransactionAdapter) {
    return transaction.status === TransactionStatus.Active
}
