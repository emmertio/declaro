import { ActionDescriptor } from '@declaro/core'
import type { ITransaction, TransactionStatus } from '../transaction/transaction-interface'
import { DomainEvent } from './domain-event'

/**
 * The lifecycle events every transaction emits, top-level and nested alike. Each value is the `action` of the event's
 * descriptor, so the full event type is `declaro::transaction.<action>`, e.g. `declaro::transaction.beforeCommit`.
 *
 * A `before*` listener that throws stops that step: the adapter isn't called and the status doesn't change. An
 * `after*` listener that throws propagates to the caller, but the step has already happened.
 */
export enum TransactionEvent {
    /** Emitted before the adapter begins the transaction. The transaction is still `Pending`, with its parent set. */
    BeforeBegin = 'beforeBegin',
    /** Emitted once the transaction is `Active` and current. */
    AfterBegin = 'afterBegin',
    /** Emitted before the adapter commits the transaction, after everything its commit cascades to is committed. */
    BeforeCommit = 'beforeCommit',
    /** Emitted once the transaction is `Committed`, after a top-level transaction's `afterCommit` callbacks ran. */
    AfterCommit = 'afterCommit',
    /** Emitted before the adapter rolls the transaction back, after everything its rollback cascades to is rolled back. */
    BeforeRollback = 'beforeRollback',
    /** Emitted once the transaction is `RolledBack`. */
    AfterRollback = 'afterRollback',
}

/**
 * The serializable summary a {@link TransactionLifecycleEvent} carries as its `data`. Plain values only, so the event
 * survives `JSON.stringify` (for example when forwarded to Redis).
 */
export interface ITransactionEventData {
    /** The transaction's stable id. */
    id: string
    /** How deeply the transaction is nested. `0` for a top-level transaction. */
    depth: number
    /** The transaction's status when the event was emitted. */
    status: TransactionStatus
    /** The id of the transaction it is nested in, if any. */
    parentId?: string
}

/**
 * A transaction lifecycle event. Its `data` is a plain {@link ITransactionEventData} summary, taken when the event was
 * emitted. The live transaction is available to in-process listeners as {@link TransactionLifecycleEvent.transaction},
 * which is never serialized.
 *
 * @example
 * ```ts
 * app.on(TransactionLifecycleEvent.getType(TransactionEvent.AfterCommit), (context, event: TransactionLifecycleEvent) => {
 *     console.log(`Transaction ${event.data?.id} committed`)
 * })
 * ```
 */
export class TransactionLifecycleEvent extends DomainEvent<ITransactionEventData> {
    /** The namespace of every transaction event's descriptor. */
    static readonly namespace = 'declaro'
    /** The resource of every transaction event's descriptor. */
    static readonly resource = 'transaction'

    /**
     * The live transaction the event is about. Non-enumerable, so it is left out of serialization and spreads.
     */
    declare readonly transaction: ITransaction

    /**
     * @param action - Which lifecycle step the event is for.
     * @param transaction - The transaction the event is about. Its current state is summarized into `data`.
     */
    constructor(action: TransactionEvent, transaction: ITransaction) {
        super({
            descriptor: TransactionLifecycleEvent.getDescriptor(action),
            data: summarize(transaction),
        })

        Object.defineProperty(this, 'transaction', { value: transaction, enumerable: false, writable: false })
    }

    /**
     * Builds the descriptor for a transaction event, the way `BaseModelService.getDescriptor` does for model events.
     *
     * @param action - The lifecycle step.
     * @returns The descriptor `declaro::transaction.<action>`.
     */
    static getDescriptor(action: TransactionEvent): ActionDescriptor {
        return ActionDescriptor.fromJSON({
            namespace: TransactionLifecycleEvent.namespace,
            resource: TransactionLifecycleEvent.resource,
            action,
        })
    }

    /**
     * Gets the event type string to listen for.
     *
     * @param action - The lifecycle step.
     * @returns The type, e.g. `declaro::transaction.beforeCommit`.
     */
    static getType(action: TransactionEvent): string {
        return TransactionLifecycleEvent.getDescriptor(action).toString()
    }
}

/**
 * Takes a plain snapshot of the parts of a transaction an event may carry.
 */
function summarize(transaction: ITransaction): ITransactionEventData {
    const data: ITransactionEventData = {
        id: transaction.id,
        depth: transaction.depth,
        status: transaction.status,
    }

    if (transaction.parent) {
        data.parentId = transaction.parent.id
    }

    return data
}
