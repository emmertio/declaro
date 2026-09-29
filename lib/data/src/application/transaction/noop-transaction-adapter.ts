import { TransactionAdapter } from './transaction-adapter'

/**
 * A transaction adapter whose transitions do nothing. It still tracks status.
 *
 * Return one from `createNested()` when the ORM can't nest transactions. Nested work then just joins the outer
 * transaction:
 *
 * - An error that escapes the nested callback still rolls back everything, because it propagates to the outer
 *   transaction.
 * - An error caught inside the outer callback does **not** undo the nested work. Without savepoints there is nothing
 *   to roll back to, so it is committed with the outer transaction.
 */
export class NoopTransactionAdapter extends TransactionAdapter {
    /** Does nothing. */
    protected async onBegin(): Promise<void> {}

    /** Does nothing. */
    protected async onCommit(): Promise<void> {}

    /** Does nothing. */
    protected async onRollback(): Promise<void> {}

    /**
     * @returns Another no-op adapter nested in this one.
     */
    protected createNested(): TransactionAdapter {
        return new NoopTransactionAdapter(this)
    }
}
