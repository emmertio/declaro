import { beforeEach, describe, expect, it } from 'bun:test'
import { MockTransactionAdapter } from './test/mock-transaction-adapter'
import { NoActiveTransactionError } from './transaction-errors'
import { TransactionManager } from './transaction-manager'
import {
    createTransactionStore,
    forkTransactionStore,
    getDefaultTransactionManager,
    getOrCreateTransactionSession,
    getTransactionSession,
    getTransactionStore,
    resetTransactionState,
    resolveTransactionManager,
    runWithTransactionStore,
    setDefaultTransactionManager,
} from './transaction-session'

describe('transaction session', () => {
    let manager: TransactionManager<any>

    beforeEach(() => {
        resetTransactionState()
        manager = new TransactionManager(new MockTransactionAdapter())
    })

    it('has no store until something needs one', () => {
        expect(getTransactionStore()).toBeNull()
        expect(getTransactionSession(manager)).toBeUndefined()
    })

    it('binds a store to the current async branch', async () => {
        const store = createTransactionStore()

        await runWithTransactionStore(store, async () => {
            expect(getTransactionStore()).toBe(store)
            await Promise.resolve()
            expect(getTransactionStore()).toBe(store)
        })

        expect(getTransactionStore()).toBeNull()
    })

    it('creates a fallback session outside of any bound store', () => {
        const session = getOrCreateTransactionSession(manager)

        expect(session.manager).toBe(manager)
        expect(getTransactionSession(manager)).toBe(session)
        expect(getTransactionStore()?.current).toBe(manager)
    })

    it('reuses an existing session for the same manager', () => {
        const first = getOrCreateTransactionSession(manager)
        const second = getOrCreateTransactionSession(manager)

        expect(second).toBe(first)
    })

    it('keeps sessions of other managers reachable when forking', () => {
        const other = new TransactionManager(new MockTransactionAdapter())
        const otherSession = getOrCreateTransactionSession(other)
        const session = { manager, stack: [] }
        const forked = forkTransactionStore(manager, session)

        runWithTransactionStore(forked, () => {
            expect(getTransactionSession(manager)).toBe(session)
            expect(getTransactionSession(other)).toBe(otherSession)
            expect(getTransactionStore()?.current).toBe(manager)
        })
    })

    it('resolves the default manager when nothing is active', () => {
        expect(getDefaultTransactionManager()).toBeNull()
        setDefaultTransactionManager(manager)

        expect(resolveTransactionManager()).toBe(manager)
        expect(getDefaultTransactionManager()).toBe(manager)
    })

    it('prefers an explicit manager over the default', () => {
        const explicit = new TransactionManager(new MockTransactionAdapter())
        setDefaultTransactionManager(manager)

        expect(resolveTransactionManager(explicit)).toBe(explicit)
    })

    it('prefers the manager of the innermost transaction over the default', () => {
        const inner = new TransactionManager(new MockTransactionAdapter())
        setDefaultTransactionManager(manager)
        const store = forkTransactionStore(inner, { manager: inner, stack: [] })

        runWithTransactionStore(store, () => {
            expect(resolveTransactionManager()).toBe(inner)
        })
    })

    it('throws when no manager can be resolved', () => {
        expect(() => resolveTransactionManager()).toThrow(NoActiveTransactionError)
    })

    it('clears the fallback store and default manager on reset', () => {
        setDefaultTransactionManager(manager)
        getOrCreateTransactionSession(manager)

        resetTransactionState()

        expect(getTransactionStore()).toBeNull()
        expect(getDefaultTransactionManager()).toBeNull()
    })
})

describe('refreshCurrentTransactionManager', () => {
    beforeEach(() => {
        resetTransactionState()
    })

    it('falls back to a manager that still has an active transaction', async () => {
        const primary = new TransactionManager(new MockTransactionAdapter())
        const secondary = new TransactionManager(new MockTransactionAdapter())

        const outer = await primary.start()
        await secondary.start()
        expect(resolveTransactionManager()).toBe(secondary)

        await secondary.commit()

        expect(resolveTransactionManager()).toBe(primary)
        expect(primary.current()).toBe(outer)

        await primary.commit()

        expect(getTransactionStore()?.current).toBeNull()
    })
})
