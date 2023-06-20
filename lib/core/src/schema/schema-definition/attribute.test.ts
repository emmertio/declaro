import { Context } from '../../context'
import { EmbeddedType, NumberFormat, RelationFormat, t } from './attribute'
import { defineCollection } from './collection'
import { describe, it, expect } from 'vitest'

describe('Attributes', () => {
    it('Should define string attributes', async () => {
        const attr = await t.string()({ name: 'name' }, new Context())

        expect(attr.nullable).toBe(true)
        expect(
            attr.classProperty({
                name: attr.name,
                labels: attr.labels,
                nullable: attr.nullable,
                title: attr.title,
            }),
        ).toBe('name?: string')
        expect(attr.default).toBe(undefined)
        expect(attr.description).toBe('')
        expect(attr.format).toBe('text-short')
        expect(attr.graphql).toBe('String')
        expect(attr.labels.singularEntityName).toBe('Name')
        expect(attr.name).toBe('name')
        expect(attr.nullable).toBe(true)
        expect(attr.title).toBe('Name')
        expect(attr.typescript).toBe('string')
    })

    it('Should define a relation', async () => {
        const movieRef = defineCollection('movie', (context) => ({
            description: 'A movie in the database.',
            properties: {
                title: t.string(),
                description: t.string({
                    format: 'text-long',
                }),
                budget: t.number({ format: NumberFormat.FLOAT }),
            },
        }))

        const m2m = await t.relation({
            model: movieRef,
            format: RelationFormat.ManyToMany,
        })({ name: 'movie' }, new Context())

        expect(m2m.model.name).toBe('movie')
        expect(m2m.model.title).toBe('Movie')
        expect(m2m.model.description).toBe('A movie in the database.')
        expect(m2m.type).toBe('relation')
        expect(m2m.format).toBe(RelationFormat.ManyToMany)

        const m2o = await t.relation({
            model: movieRef,
            format: RelationFormat.ManyToOne,
        })({ name: 'movie' }, new Context())

        expect(m2o.format).toBe(RelationFormat.ManyToOne)

        const o2m = await t.relation({
            model: movieRef,
            format: RelationFormat.OneToMany,
        })({ name: 'movie' }, new Context())

        expect(o2m.format).toBe(RelationFormat.OneToMany)

        const o2o = await t.relation({
            model: movieRef,
            format: RelationFormat.OneToOne,
        })({ name: 'movie' }, new Context())

        expect(o2o.format).toBe(RelationFormat.OneToOne)
    })

    it('Should define integer attributes', async () => {
        const attr = await t.number({
            format: NumberFormat.INT,
            nullable: false,
            default: 42,
            title: 'Custom Title',
            description: 'Your age',
        })({ name: 'age' }, new Context())

        expect(attr.nullable).toBe(false)
        expect(
            attr.classProperty({
                name: attr.name,
                labels: attr.labels,
                nullable: attr.nullable,
                title: attr.title,
            }),
        ).toBe('age: number')
        expect(attr.default).toBe(42)
        expect(attr.description).toBe('Your age')
        expect(attr.format).toBe(NumberFormat.INT)
        expect(attr.graphql).toBe('Int')
        expect(attr.typescript).toBe('number')
        expect(attr.title).toBe('Custom Title')
    })

    it('Should define float attributes', async () => {
        const attr = await t.number({
            format: NumberFormat.FLOAT,
            nullable: false,
            default: 42.42,
            title: 'Custom Title',
            description: 'Your age',
        })({ name: 'age' }, new Context())

        expect(attr.nullable).toBe(false)
        expect(
            attr.classProperty({
                name: attr.name,
                labels: attr.labels,
                nullable: attr.nullable,
                title: attr.title,
            }),
        ).toBe('age: number')
        expect(attr.default).toBe(42.42)
        expect(attr.description).toBe('Your age')
        expect(attr.format).toBe(NumberFormat.FLOAT)
        expect(attr.graphql).toBe('Float')
        expect(attr.typescript).toBe('number')
        expect(attr.title).toBe('Custom Title')
    })

    it('Should define boolean attributes', async () => {
        const attr = await t.boolean({
            nullable: false,
            default: true,
            title: 'Custom Title',
            description: 'Your age',
        })({ name: 'age' }, new Context())

        expect(attr.nullable).toBe(false)
        expect(
            attr.classProperty({
                name: attr.name,
                labels: attr.labels,
                nullable: attr.nullable,
                title: attr.title,
            }),
        ).toBe('age: boolean')
        expect(attr.default).toBe(true)
        expect(attr.description).toBe('Your age')
        expect(attr.format).toBe('boolean')
        expect(attr.graphql).toBe('Boolean')
        expect(attr.typescript).toBe('boolean')
        expect(attr.title).toBe('Custom Title')
    })

    it('Should define default embedded attributes', async () => {
        const movieRef = defineCollection('movie', (context) => ({
            description: 'A movie in the database.',
            properties: {
                title: t.string(),
                description: t.string({
                    format: 'text-long',
                }),
                budget: t.number({ format: NumberFormat.FLOAT }),
            },
        }))

        const attr = await t.embedded({
            model: movieRef,
        })({ name: 'movie' }, new Context())

        expect(attr.type).toBe('embedded')
        expect(attr.format).toBe(EmbeddedType.One)
        expect(attr.model.name).toBe('movie')
        expect(attr.model.title).toBe('Movie')
        expect(attr.model.description).toBe('A movie in the database.')
        expect(attr.type).toBe('embedded')

        expect(
            attr.classProperty({
                name: attr.name,
                labels: attr.labels,
                nullable: attr.nullable,
                title: attr.title,
            }),
        ).toBe('movie?: Movie')

        expect(attr.graphql).toBe('Movie')
        expect(attr.typescript).toBe('Movie')
    })

    it('Should define single embedded attributes', async () => {
        const movieRef = defineCollection('movie', (context) => ({
            description: 'A movie in the database.',
            properties: {
                title: t.string(),
                description: t.string({
                    format: 'text-long',
                }),
                budget: t.number({ format: NumberFormat.FLOAT }),
            },
        }))

        const attr = await t.embedded({
            model: movieRef,
            format: EmbeddedType.One,
        })({ name: 'movie' }, new Context())

        expect(attr.format).toBe(EmbeddedType.One)

        expect(
            attr.classProperty({
                name: attr.name,
                labels: attr.labels,
                nullable: attr.nullable,
                title: attr.title,
            }),
        ).toBe('movie?: Movie')

        expect(attr.graphql).toBe('Movie')
        expect(attr.typescript).toBe('Movie')
    })

    it('Should define multiple embedded attributes', async () => {
        const movieRef = defineCollection('movie', (context) => ({
            description: 'A movie in the database.',
            properties: {
                title: t.string(),
                description: t.string({
                    format: 'text-long',
                }),
                budget: t.number({ format: NumberFormat.FLOAT }),
            },
        }))

        const attr = await t.embedded({
            model: movieRef,
            format: EmbeddedType.Many,
        })({ name: 'movie' }, new Context())

        expect(attr.format).toBe(EmbeddedType.Many)

        expect(
            attr.classProperty({
                name: attr.name,
                labels: attr.labels,
                nullable: attr.nullable,
                title: attr.title,
            }),
        ).toBe('movie?: Movie[]')

        expect(attr.graphql).toBe('[Movie]')
        expect(attr.typescript).toBe('Movie[]')
    })

    it('Should define json attributes', async () => {
        const attr = await t.json({
            nullable: false,
            default: { foo: 'bar' },
            title: 'Custom Title',
            description: 'Your age',
        })({ name: 'age' }, new Context())

        expect(attr.nullable).toBe(false)
        expect(
            attr.classProperty({
                name: attr.name,
                labels: attr.labels,
                nullable: attr.nullable,
                title: attr.title,
            }),
        ).toBe('age: any')
        expect(attr.default).toEqual({ foo: 'bar' })
        expect(attr.description).toBe('Your age')
        expect(attr.format).toBe('json')
        expect(attr.graphql).toBe('JSON')
        expect(attr.typescript).toBe('any')
        expect(attr.title).toBe('Custom Title')
    })
})
