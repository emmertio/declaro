import { describe, expect, it } from 'bun:test'
import { ActionDescriptor, type IActionDescriptorInput } from '@declaro/core'
import { ModelMutationEvent, type IMutationEntry } from './model-mutation-event'

interface IBook {
    id: number
    title: string
}

interface IBookInput {
    id?: number
    title: string
}

interface IBookLookup {
    id: number
}

type BookEvent = ModelMutationEvent<IBook, IBookInput, IBookLookup>
type BookEntry = IMutationEntry<IBook, IBookInput, IBookLookup>

const descriptor: IActionDescriptorInput = { namespace: 'books', resource: 'book', action: 'afterUpdate' }

describe('ModelMutationEvent', () => {
    describe('construction', () => {
        it('names its type after the descriptor and starts with no entries', () => {
            const event: BookEvent = new ModelMutationEvent(descriptor)

            expect(event.type).toBe('books::book.afterUpdate')
            expect(event.descriptor.toString()).toEqual(new ActionDescriptor(descriptor).toString())
            expect(event.entries).toEqual([])
            expect(event.size).toBe(0)
            expect(event.meta).toEqual({})
        })

        it('wraps a single entry in an array', () => {
            const event: BookEvent = new ModelMutationEvent(descriptor, { input: { title: 'One' } })

            expect(event.size).toBe(1)
            expect(event.entries[0].input.title).toBe('One')
        })

        it('keeps an array of entries in order', () => {
            const event: BookEvent = new ModelMutationEvent(descriptor, [
                { input: { title: 'One' } },
                { input: { title: 'Two' } },
            ])

            expect(event.inputs.map((input) => input.title)).toEqual(['One', 'Two'])
        })

        it('fills in the keys its entries reveal when it knows the primary key', () => {
            const event: BookEvent = new ModelMutationEvent(
                descriptor,
                [{ input: { id: 1, title: 'One' } }, { input: { title: 'Two' } }],
                { primaryKey: 'id' },
            )

            expect(event.entries[0].key).toBe(1)
            expect(event.entries[1].key).toBeUndefined()
            expect(event.keys).toEqual([1])
        })
    })

    describe('key resolution', () => {
        it('prefers an explicit key over anything on the records', () => {
            const event: BookEvent = new ModelMutationEvent(
                descriptor,
                { key: 99, input: { id: 1, title: 'One' }, result: { id: 1, title: 'One' } },
                { primaryKey: 'id' },
            )

            expect(event.keys).toEqual([99])
            expect(event.get(99)).toBeDefined()
            expect(event.get(1)).toBeUndefined()
        })

        it('reads the key off the result, then existing, then lookup, then input', () => {
            const fromResult: BookEvent = new ModelMutationEvent(
                descriptor,
                {
                    input: { id: 4, title: 'x' },
                    lookup: { id: 3 },
                    existing: { id: 2, title: 'x' },
                    result: { id: 1, title: 'x' },
                },
                { primaryKey: 'id' },
            )
            const fromExisting: BookEvent = new ModelMutationEvent(
                descriptor,
                { input: { id: 4, title: 'x' }, lookup: { id: 3 }, existing: { id: 2, title: 'x' } },
                { primaryKey: 'id' },
            )
            const fromLookup: BookEvent = new ModelMutationEvent(
                descriptor,
                { input: { id: 4, title: 'x' }, lookup: { id: 3 } },
                { primaryKey: 'id' },
            )
            const fromInput: BookEvent = new ModelMutationEvent(
                descriptor,
                { input: { id: 4, title: 'x' } },
                { primaryKey: 'id' },
            )

            expect(fromResult.keys).toEqual([1])
            expect(fromExisting.keys).toEqual([2])
            expect(fromLookup.keys).toEqual([3])
            expect(fromInput.keys).toEqual([4])
        })

        it('knows no keys without a primary key in meta unless they are explicit', () => {
            const event: BookEvent = new ModelMutationEvent(descriptor, [
                { input: { id: 1, title: 'One' } },
                { key: 2, input: { id: 2, title: 'Two' } },
            ])

            expect(event.keys).toEqual([2])
            expect(event.has(1)).toBe(false)
            expect(event.has(2)).toBe(true)
        })

        it('ignores primary key values that are not strings or numbers', () => {
            const event = new ModelMutationEvent<{ id: unknown }, { id: unknown }>(
                descriptor,
                [{ input: { id: null } }, { input: { id: { nested: true } } }],
                { primaryKey: 'id' },
            )

            expect(event.keys).toEqual([])
        })

        it('accepts string keys', () => {
            const event = new ModelMutationEvent<{ uuid: string }, { uuid: string }>(
                descriptor,
                { input: { uuid: 'abc' } },
                { primaryKey: 'uuid' },
            )

            expect(event.has('abc')).toBe(true)
            expect(event.getInput('abc')).toEqual({ uuid: 'abc' })
        })
    })

    describe('lookups by key', () => {
        const entries: BookEntry[] = [
            {
                lookup: { id: 1 },
                input: { title: 'One updated' },
                existing: { id: 1, title: 'One' },
                result: { id: 1, title: 'One updated' },
            },
            { lookup: { id: 2 }, input: { title: 'Two updated' }, existing: { id: 2, title: 'Two' } },
        ]
        const event: BookEvent = new ModelMutationEvent(descriptor, entries, { primaryKey: 'id' })

        it('finds an entry and its parts by key', () => {
            expect(event.get(1)).toBe(entries[0])
            expect(event.getInput(1)?.title).toBe('One updated')
            expect(event.getExisting(1)?.title).toBe('One')
            expect(event.getResult(1)?.title).toBe('One updated')
        })

        it('returns undefined for parts an entry does not have and for unknown keys', () => {
            expect(event.getResult(2)).toBeUndefined()
            expect(event.get(3)).toBeUndefined()
            expect(event.getInput(3)).toBeUndefined()
            expect(event.has(3)).toBe(false)
        })

        it('lists the collections it has, in entry order', () => {
            expect(event.keys).toEqual([1, 2])
            expect(event.lookups).toEqual([{ id: 1 }, { id: 2 }])
            expect(event.existing.map((record) => record.title)).toEqual(['One', 'Two'])
            expect(event.results.map((record) => record.title)).toEqual(['One updated'])
        })

        it('indexes the first entry when two share a key', () => {
            const duplicated: BookEvent = new ModelMutationEvent(
                descriptor,
                [{ input: { id: 1, title: 'first' } }, { input: { id: 1, title: 'second' } }],
                { primaryKey: 'id' },
            )

            expect(duplicated.size).toBe(2)
            expect(duplicated.getInput(1)?.title).toBe('first')
        })
    })

    describe('mutation', () => {
        it('assigns results by position and reveals their keys', () => {
            const event: BookEvent = new ModelMutationEvent(
                descriptor,
                [{ input: { title: 'One' } }, { input: { title: 'Two' } }],
                { primaryKey: 'id' },
            )
            expect(event.keys).toEqual([])

            const returned = event.setResults([
                { id: 10, title: 'One' },
                { id: 20, title: 'Two' },
            ])

            expect(returned).toBe(event)
            expect(event.keys).toEqual([10, 20])
            expect(event.getResult(20)?.title).toBe('Two')
            expect(event.getInput(10)?.title).toBe('One')
        })

        it('refuses a result count that does not match the entries', () => {
            const event: BookEvent = new ModelMutationEvent(descriptor, [{ input: { title: 'One' } }], {
                primaryKey: 'id',
            })

            expect(() => event.setResults([])).toThrow('Expected 1 result(s) for 1 entries, received 0')
        })

        it('rebuilds the index when entries are replaced or added', () => {
            const event: BookEvent = new ModelMutationEvent(
                descriptor,
                { input: { id: 1, title: 'One' } },
                { primaryKey: 'id' },
            )
            expect(event.has(1)).toBe(true)

            event.setEntries([{ input: { id: 2, title: 'Two' } }])
            expect(event.has(1)).toBe(false)
            expect(event.has(2)).toBe(true)

            event.add({ input: { id: 3, title: 'Three' } })
            expect(event.size).toBe(2)
            expect(event.has(3)).toBe(true)
        })

        it('rebuilds the index on reindex after a key is assigned directly', () => {
            const event: BookEvent = new ModelMutationEvent(descriptor, { input: { title: 'One' } })
            expect(event.has(7)).toBe(false)

            event.entries[0].key = 7
            expect(event.has(7)).toBe(false)

            event.reindex()
            expect(event.has(7)).toBe(true)
        })

        it('merges meta', () => {
            const event: BookEvent = new ModelMutationEvent(descriptor, [], { primaryKey: 'id' })

            event.setMeta({ args: { options: { scope: 'detail' } } })

            expect(event.meta).toEqual({ primaryKey: 'id', args: { options: { scope: 'detail' } } })
        })
    })

    describe('serialization', () => {
        it('serializes its entries as data alongside the usual event fields', () => {
            const event: BookEvent = new ModelMutationEvent(
                descriptor,
                [
                    {
                        lookup: { id: 1 },
                        input: { title: 'One updated' },
                        existing: { id: 1, title: 'One' },
                        result: { id: 1, title: 'One updated' },
                    },
                ],
                { primaryKey: 'id', args: { options: { scope: 'detail' } } },
            )

            const json = JSON.parse(JSON.stringify(event))

            expect(json.type).toBe('books::book.afterUpdate')
            expect(json.eventId).toBe(event.eventId)
            expect(json.timestamp).toBe(event.timestamp.toISOString())
            expect(json.meta).toEqual({ primaryKey: 'id', args: { options: { scope: 'detail' } } })
            expect(json.data).toEqual([
                {
                    key: 1,
                    lookup: { id: 1 },
                    input: { title: 'One updated' },
                    existing: { id: 1, title: 'One' },
                    result: { id: 1, title: 'One updated' },
                },
            ])
            expect(json.index).toBeUndefined()
        })
    })
})
