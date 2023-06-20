import { Context } from '../../context'
import { Scalar } from '../utils/data-types'
import { NumberFormat, RelationFormat, string, t } from './attribute'
import { defineCollection } from './collection'
import { describe, it, expect } from 'vitest'

describe('Collection tests', () => {
    it('Should define an entity with minimal config', async () => {
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

        const context = new Context()

        const movieCollection = await movieRef.load(context)

        expect(movieCollection.title).toBe('Movie')
        expect(movieCollection.description).toBe('A movie in the database.')
        expect(movieCollection.properties.title.name).toBe('title')
        expect(movieCollection.properties.title.type).toBe(Scalar.String)
        expect(movieCollection.properties.title.title).toBe('Title')
        expect(movieCollection.properties.title.description).toBe('')
        expect(movieCollection.properties.title.labels.singularLabel).toBe(
            'Title',
        )
        expect(movieCollection.properties.title.labels.pluralLabel).toBe(
            'Titles',
        )
        expect(movieCollection.properties.title.labels.singularParameter).toBe(
            'title',
        )
        expect(movieCollection.properties.title.labels.pluralParameter).toBe(
            'titles',
        )
        expect(movieCollection.properties.title.labels.singularSlug).toBe(
            'title',
        )
        expect(movieCollection.properties.title.labels.pluralSlug).toBe(
            'titles',
        )
        expect(movieCollection.properties.title.labels.singularEntityName).toBe(
            'Title',
        )
        expect(movieCollection.properties.title.labels.pluralEntityName).toBe(
            'Titles',
        )
        expect(movieCollection.properties.title.format).toBe('text-short')
        expect(movieCollection.properties.title.nullable).toBe(true)
        expect(movieCollection.properties.title.default).toBe(undefined)
        expect(movieCollection.properties.title.typescript).toBe('string')
        expect(movieCollection.properties.title.graphql).toBe('String')

        expect(movieCollection.properties.description.name).toBe('description')
        expect(movieCollection.properties.description.type).toBe(Scalar.String)
        expect(movieCollection.properties.description.title).toBe('Description')
        expect(movieCollection.properties.description.description).toBe('')
        expect(
            movieCollection.properties.description.labels.singularLabel,
        ).toBe('Description')
        expect(movieCollection.properties.description.labels.pluralLabel).toBe(
            'Descriptions',
        )
        expect(
            movieCollection.properties.description.labels.singularParameter,
        ).toBe('description')
        expect(
            movieCollection.properties.description.labels.pluralParameter,
        ).toBe('descriptions')
        expect(movieCollection.properties.description.labels.singularSlug).toBe(
            'description',
        )
        expect(movieCollection.properties.description.labels.pluralSlug).toBe(
            'descriptions',
        )
        expect(
            movieCollection.properties.description.labels.singularEntityName,
        ).toBe('Description')
        expect(
            movieCollection.properties.description.labels.pluralEntityName,
        ).toBe('Descriptions')
        expect(movieCollection.properties.description.format).toBe('text-long')
        expect(movieCollection.properties.description.nullable).toBe(true)
        expect(movieCollection.properties.description.default).toBe(undefined)
        expect(movieCollection.properties.description.typescript).toBe('string')
        expect(movieCollection.properties.description.graphql).toBe('String')
    })

    it('Should define relational entities', async () => {
        // Define movie and actor collections that relate to each other
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
        const actorRef = defineCollection('actor', (context) => ({
            description: 'An actor in the database.',
            properties: {
                name: t.string(),
                description: t.string({
                    format: 'text-long',
                }),
                movies: t.relation({
                    format: 'many-to-many',
                    model: movieRef,
                }),
            },
        }))

        const context = new Context()
        const actorCollection = await actorRef.load(context)

        expect(actorCollection.properties.movies.name).toBe('movies')
        expect(actorCollection.properties.movies.type).toBe(Scalar.Relation)
        expect(actorCollection.properties.movies.title).toBe('Movies')
        expect(actorCollection.properties.movies.description).toBe('')
        expect(actorCollection.properties.movies.format).toBe(
            RelationFormat.ManyToMany,
        )
    })

    it('Should define a collection that extends another one', async () => {
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

        const personRef = defineCollection('person', (context) => ({
            description: 'A person in the database.',
            properties: {
                name: t.string(),
                description: t.string({
                    format: 'text-long',
                }),
            },
        }))

        const actorRef = defineCollection('actor', (context) => ({
            description: 'An actor in the database.',
            properties: {
                actedIn: t.relation({
                    format: RelationFormat.ManyToMany,
                    model: movieRef,
                }),
            },
            extends: [personRef],
        }))

        const directorRef = defineCollection('director', (context) => ({
            description: 'A director in the database.',
            properties: {
                directed: t.relation({
                    format: RelationFormat.ManyToMany,
                    model: movieRef,
                }),
            },
            extends: [personRef],
        }))

        const actorCollection = await actorRef.load(new Context())
        const directorCollection = await directorRef.load(new Context())

        expect(actorCollection.properties.title.name).toBe('title')
        expect(actorCollection.properties.description.name).toBe('description')
        expect(actorCollection.properties.actedIn.name).toBe('actedIn')

        expect(directorCollection.properties.title.name).toBe('title')
        expect(directorCollection.properties.description.name).toBe(
            'description',
        )
        expect(directorCollection.properties.directed.name).toBe('directed')
    })
})
