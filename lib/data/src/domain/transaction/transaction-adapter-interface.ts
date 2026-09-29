export type TransactionRunnerFn = (tx: ITransactionAdapter) => any

export interface ITransactionRunner {
    run(runner: TransactionRunnerFn): Promise<any>
}

export interface ITransactionAdapter extends ITransactionRunner {
    begin(): void
    commit(): void
    rollback(): void
}
