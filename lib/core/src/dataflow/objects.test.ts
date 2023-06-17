import { merge } from './objects'
import { describe, it } from 'vitest'

describe('Object manipulation tests', () => {
    it('Should merge objects', ({ expect }) => {
        const CUSTOM_KEY = Symbol()

        const objectA = {
            a: 'a',
            1: 1,
            [CUSTOM_KEY]: 42,
        }

        const objectB = {
            c: 3,
            p: 'O',
        }

        const output = merge(objectA, objectB)

        expect(output[1]).toBe(1)
        expect(output.a).toBe('a')
        expect(output[CUSTOM_KEY]).toBe(42)
        expect(output.c).toBe(3)
        expect(output.p).toBe('O')

        expect(objectA[1]).toBe(1)
        expect(objectA.a).toBe('a')
        expect(objectA[CUSTOM_KEY]).toBe(42)
        expect(objectA['c']).toBe(3)
        expect(objectA['p']).toBe('O')
    })

    // it('Should deep merge objects', () => {
    //     const objectA = {
    //         d: {
    //             r: 2,
    //         },
    //         characters: ['Luke', 'Leia'],
    //     }

    //     const objectB = {
    //         d: {
    //             d: 2,
    //         },
    //         characters: ['Han', 'Chewie'],
    //     }

    //     const output = merge(objectA, objectB)

    //     expect(output.d.r).toBe(2)
    //     expect(output.d.d).toBe(2)
    //     expect(output.characters[0]).toBe('Luke')
    //     expect(output.characters[1]).toBe('Leia')
    //     expect(output.characters[2]).toBe('Han')
    //     expect(output.characters[3]).toBe('Chewie')
    // })

    it('Should add non-array items to matching arrays', ({ expect }) => {
        const a = {
            val: 4,
            arr: [1, 2],
        }

        const b = {
            val: [5, 6],
            arr: 3,
        }

        const c = merge(a, b)

        expect(c.val[0]).toBe(4)
        expect(c.val[1]).toBe(5)
        expect(c.val[2]).toBe(6)

        expect(c.arr[0]).toBe(1)
        expect(c.arr[1]).toBe(2)
        expect(c.arr[2]).toBe(3)
    })

    it('Should handle nulls gracefully', ({ expect }) => {
        const a = {
            val: null,
            obj: undefined,
        }

        const b = {
            val: [5, 6],
            obj: {
                a: 1,
                b: 2,
            },
        }

        const c = merge(a, b)

        expect(c.val[0]).toBe(5)
        expect(c.val[1]).toBe(6)

        expect(c.obj.a).toBe(1)
        expect(c.obj.b).toBe(2)
    })

    // it('Should handle circular structures', () => {
    //     const b = {
    //         val: 2,
    //         a: undefined,
    //     }

    //     const a = {
    //         val: 1,
    //         b: b,
    //     }

    //     b.a = a

    //     const c = merge(a, b)

    //     expect(c.a.val).toBe(1)
    //     expect(c.b.val).toBe(2)
    // })
})
