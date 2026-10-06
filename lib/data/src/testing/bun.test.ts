import { Context, useDeclaro, withContext, type DeclaroScope } from '@declaro/core'
import { afterAll, describe, expect, it } from 'bun:test'
import { Transaction } from '../application/transaction/transaction'
import { transactionModule } from '../application/transaction/transaction-module'
import { TransactionStatus, type ITransaction } from '../domain/transaction/transaction-interface'
import { MockBookSchema } from '../test/mock/models/mock-book-models'
import { MockMemoryRepository } from '../test/mock/repositories/mock-memory-repository'
import { MockTransactionAdapter } from '../test/mock/transaction/mock-transaction-adapter'
import type { ITransactionScope } from '../types/transaction-context'
import * as main from '../index'
import * as bun from './bun'
import { rollbackEachTest, rollbackTest, withRollback } from './bun'

const publishedDate = new Date('2020-01-01T00:00:00.000Z')

const repository = new MockMemoryRepository({ schema: MockBookSchema })
const adapter = new MockTransactionAdapter({ repositories: [repository] })
const app = new Context<DeclaroScope & ITransactionScope>()
await app.use(useDeclaro(), transactionModule({ adapter }))

const titles = async () => (await repository.search({})).results.map((book) => book.title).sort()
const log = () => adapter.operations.map(({ operation, depth }) => `${operation}@${depth}`)

describe('@declaro/data/testing/bun', () => {
    it('re-exports withRollback and rollbackTest from the main entry', () => {
        expect(bun.withRollback).toBe(main.withRollback)
        expect(bun.rollbackTest).toBe(main.rollbackTest)
    })
})

describe('rollbackEachTest (Bun), with no hooks argument', () => {
    const suite = rollbackEachTest(app)
    const seen: ITransaction[] = []

    afterAll(() => {
        // Runs after the last test's afterEach: both test transactions were rolled back, nested commits included.
        expect(seen).toHaveLength(2)
        expect(seen[0]).not.toBe(seen[1])
        expect(seen.map((transaction) => transaction.status)).toEqual([
            TransactionStatus.RolledBack,
            TransactionStatus.RolledBack,
        ])
        expect(log()).toEqual([
            'begin@0',
            'begin@1',
            'commit@1',
            'rollback@0',
            'begin@0',
            'begin@1',
            'commit@1',
            'rollback@0',
        ])
        expect(() => suite.transaction).toThrow('No test transaction is active')
    })

    it('runs the first test in a transaction, and commits a write in a nested one', () =>
        withContext(app, async () => {
            seen.push(suite.transaction)
            expect(suite.transaction.status).toBe(TransactionStatus.Active)
            expect(log()).toEqual(['begin@0'])

            await Transaction.run(() =>
                repository.create({ id: 1, title: 'Dune', author: 'Frank Herbert', publishedDate }),
            )
            expect(await titles()).toEqual(['Dune'])
        }))

    it("starts the next test with the previous test's write rolled back", () =>
        withContext(app, async () => {
            seen.push(suite.transaction)
            expect(log()).toEqual(['begin@0', 'begin@1', 'commit@1', 'rollback@0', 'begin@0'])
            expect(await titles()).toEqual([])

            await Transaction.run(() =>
                repository.create({ id: 2, title: 'Emma', author: 'Jane Austen', publishedDate }),
            )
            expect(await titles()).toEqual(['Emma'])
        }))
})

describe('rollbackTest and withRollback (Bun entry)', () => {
    it(
        'rolls back a rollbackTest body',
        rollbackTest(app, async () => {
            await repository.create({ id: 3, title: 'Ulysses', author: 'James Joyce', publishedDate })
            expect(await titles()).toEqual(['Ulysses'])
        }),
    )

    it('rolls back a withRollback body', async () => {
        expect(await titles()).toEqual([])
        await withRollback(app, async () => {
            await repository.create({ id: 4, title: 'Middlemarch', author: 'George Eliot', publishedDate })
        })
        expect(await titles()).toEqual([])
    })
})
