import type { ITransactionAdapter, TransactionRunnerFn } from '../../domain/transaction/transaction-adapter-interface'

export class TransactionAdapter implements ITransactionAdapter {
    begin(): void {
        throw new Error('Method not implemented.')
    }
    commit(): void {
        throw new Error('Method not implemented.')
    }
    rollback(): void {
        throw new Error('Method not implemented.')
    }
    run(runner: TransactionRunnerFn): Promise<any> {
        throw new Error('Method not implemented.')
    }
}
