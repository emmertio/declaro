import { Context, withContext } from '@declaro/core'
import { beforeEach, describe, expect, it } from 'bun:test'
import { Transaction } from '../../../application/transaction/transaction'
import { TransactionStack } from '../../../application/transaction/transaction-stack'
import type { ITransactionScope } from '../../../types/transaction-context'
import { MockBookSchema } from '../models/mock-book-models'
import { MockTransactionAdapter } from '../transaction/mock-transaction-adapter'
import { MockMemoryRepository } from './mock-memory-repository'

describe('MockMemoryRepository - transactions', () => {
    const publishedDate = new Date('2020-01-01T00:00:00.000Z')
    const dune = { id: 1, title: 'Dune', author: 'Frank Herbert', publishedDate }
    const emma = { id: 2, title: 'Emma', author: 'Jane Austen', publishedDate }

    let repository: MockMemoryRepository<typeof MockBookSchema>
    let adapter: MockTransactionAdapter
    let context: Context<ITransactionScope>

    const inContext = <T>(fn: () => T) => withContext(context, fn)
    /** Runs the callback in a transaction and rolls it back by throwing. */
    const runAndRollBack = (callback: () => Promise<unknown>) =>
        Transaction.run(async () => {
            await callback()
            throw new Error('roll back')
        }).catch((error: Error) => expect(error.message).toBe('roll back'))
    const titles = async () => (await repository.search({})).results.map((book) => book.title).sort()

    beforeEach(async () => {
        repository = new MockMemoryRepository({ schema: MockBookSchema })
        // Fresh Dates, so a test that mutates a stored record can't change the shared fixtures.
        await repository.create({ ...dune, publishedDate: new Date(publishedDate) })
        await repository.create({ ...emma, publishedDate: new Date(publishedDate) })

        adapter = new MockTransactionAdapter({ repositories: [repository] })
        context = new Context<ITransactionScope>()
        context.registerValue('transactionAdapter', adapter)
        context.registerValue('transactionStack', new TransactionStack())
    })

    it('undoes creates, updates and removes on a top-level rollback', async () => {
        await inContext(() =>
            runAndRollBack(async () => {
                await repository.create({ id: 3, title: 'Ulysses', author: 'James Joyce', publishedDate })
                await repository.update({ id: 1 }, { ...dune, title: 'Dune Messiah' })
                await repository.remove({ id: 2 })
                expect(await titles()).toEqual(['Dune Messiah', 'Ulysses'])
            }),
        )

        expect(await titles()).toEqual(['Dune', 'Emma'])
        expect(await repository.load({ id: 1 })).toEqual(dune)
        expect(await repository.load({ id: 3 }, { includeRemoved: true })).toBeNull()
    })

    it('keeps the writes of a committed transaction', async () => {
        await inContext(() =>
            Transaction.run(async () => {
                await repository.update({ id: 1 }, { ...dune, title: 'Dune Messiah' })
            }),
        )

        expect(await titles()).toEqual(['Dune Messiah', 'Emma'])
    })

    it('undoes only the nested writes on a nested rollback, and commits the outer ones', async () => {
        await inContext(() =>
            Transaction.run(async () => {
                await repository.update({ id: 1 }, { ...dune, title: 'Outer' })
                await runAndRollBack(async () => {
                    await repository.update({ id: 2 }, { ...emma, title: 'Nested' })
                    await repository.create({ id: 3, title: 'Nested new', author: 'Someone', publishedDate })
                })
                expect(await titles()).toEqual(['Emma', 'Outer'])
            }),
        )

        expect(await titles()).toEqual(['Emma', 'Outer'])
        expect(adapter.operations.map((op) => `${op.operation}@${op.depth}`)).toEqual([
            'begin@0',
            'begin@1',
            'rollback@1',
            'commit@0',
        ])
    })

    it('undoes a committed nested transaction’s writes on a parent rollback', async () => {
        await inContext(() =>
            runAndRollBack(async () => {
                await repository.update({ id: 1 }, { ...dune, title: 'Outer' })
                await Transaction.run(async () => {
                    await repository.update({ id: 2 }, { ...emma, title: 'Nested' })
                })
                expect(await titles()).toEqual(['Nested', 'Outer'])
            }),
        )

        expect(await titles()).toEqual(['Dune', 'Emma'])
    })

    it('restores the trash and the id counter', async () => {
        const library = new MockMemoryRepository({ schema: MockBookSchema })
        adapter.track(library)
        const untitled = { title: 'Generated', author: 'Anon', publishedDate }
        expect((await library.create(untitled)).id).toBe(1)
        await library.remove({ id: 1 })

        await inContext(() =>
            runAndRollBack(async () => {
                expect((await library.create(untitled)).id).toBe(2)
                await library.restore({ id: 1 })
                await library.remove({ id: 2 })
                expect(await library.emptyTrash()).toBe(1)
            }),
        )

        expect(await library.load({ id: 1 }, { removedOnly: true })).toEqual({ id: 1, ...untitled })
        expect(await library.load({ id: 2 }, { includeRemoved: true })).toBeNull()
        expect(await library.count({})).toBe(0)
        expect((await library.create(untitled)).id).toBe(2)
    })

    it('restores on the rollback that follows a failed commit', async () => {
        adapter.failures.commit = true

        await expect(
            inContext(() =>
                Transaction.run(async () => {
                    await repository.remove({ id: 1 })
                }),
            ),
        ).rejects.toThrow('Mock commit failure')

        expect(await titles()).toEqual(['Dune', 'Emma'])
    })

    it('leaves untracked repositories alone', async () => {
        const untracked = new MockMemoryRepository({ schema: MockBookSchema })

        await inContext(() =>
            runAndRollBack(async () => {
                await untracked.create(dune)
            }),
        )

        expect(await untracked.load({ id: 1 })).toEqual(dune)
    })

    it('tracks repositories added with track()', async () => {
        const later = new MockMemoryRepository({ schema: MockBookSchema })
        expect(adapter.track(later)).toBe(adapter)

        await inContext(() =>
            runAndRollBack(async () => {
                await later.create(dune)
            }),
        )

        expect(await later.load({ id: 1 })).toBeNull()
    })

    it('snapshots deeply, so mutating a record after begin does not leak into the restored state', async () => {
        await inContext(async () => {
            const transaction = await Transaction.begin()
            const record = (await repository.load({ id: 1 }))!
            record.title = 'Mutated'
            record.publishedDate.setUTCFullYear(1999)
            await transaction.rollback()
        })

        const restored = (await repository.load({ id: 1 }))!
        expect(restored.title).toBe('Dune')
        expect(restored.publishedDate).toBeInstanceOf(Date)
        expect(restored.publishedDate.toISOString()).toBe('2020-01-01T00:00:00.000Z')
    })

    it('restores a snapshot without consuming it', async () => {
        const snapshot = repository.snapshot()

        await repository.remove({ id: 1 })
        repository.restoreSnapshot(snapshot)
        await repository.remove({ id: 1 })
        repository.restoreSnapshot(snapshot)

        expect(await titles()).toEqual(['Dune', 'Emma'])
        expect(await repository.load({ id: 1 }, { removedOnly: true })).toBeNull()
    })
})
