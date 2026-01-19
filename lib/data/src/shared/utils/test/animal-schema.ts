// Animal Schema

import { ModelSchema } from '@declaro/core'
import { sortArray, ZodModel } from '@declaro/zod'
import z4 from 'zod/v4'
import { AnimalTraitsDetailSchema, AnimalTraitsSummarySchema } from './animal-trait-schema'

export const AnimalDetailSchema = z4.object({
    name: z4.string(),
    sound: z4.string(),
    get traits() {
        return z4.array(AnimalTraitsDetailSchema)
    },
})

export const AnimalLookupSchema = z4.object({
    id: z4.number(),
})

export const AnimalFiltersSchema = z4.object({
    text: z4.string().optional(),
    sound: z4.string().optional(),
})

export const AnimalSortSchema = sortArray(['name', 'sound'])

export const AnimalSummarySchema = z4.object({
    name: z4.string(),
    sound: z4.string(),
    get traits() {
        return z4.array(AnimalTraitsSummarySchema)
    },
})

export const AnimalSchema = ModelSchema.create('AnimalSchema')
    .read({
        detail: (h) => new ZodModel('AnimalDetail', AnimalDetailSchema),
        lookup: (h) => new ZodModel('AnimalLookup', AnimalLookupSchema),
    })
    .search({
        filters: (h) => new ZodModel('AnimalFilters', AnimalFiltersSchema),
        sort: (h) => new ZodModel('AnimalSort', AnimalSortSchema),
        summary: (h) => new ZodModel('AnimalSummary', AnimalSummarySchema),
    })

export type IAnimalSchema = typeof AnimalSchema
