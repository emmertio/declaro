import { sortArray, ZodModel } from '@declaro/zod'
import { AnimalDetailSchema, AnimalSummarySchema } from './animal-schema'

// Animal Traits Schema

import { ModelSchema } from '@declaro/core'
import z4 from 'zod/v4'

export const AnimalTraitsDetailSchema = z4.object({
    title: z4.string(),
    description: z4.string(),
    get animal() {
        return AnimalDetailSchema.optional()
    },
})

export const AnimalTraitsSummarySchema = z4.object({
    title: z4.string(),
    get animal() {
        return AnimalSummarySchema.optional()
    },
})

export const AnimalTraitsLookupSchema = z4.object({
    id: z4.number(),
})

export const AnimalTraitsFiltersSchema = z4.object({
    text: z4.string().optional(),
})

export const AnimalTraitsSortSchema = sortArray(['title'])

export const AnimalTraitsSchema = ModelSchema.create('AnimalTraitsSchema')
    .read({
        detail: (h) => new ZodModel('AnimalTraitsDetail', AnimalTraitsDetailSchema),
        lookup: (h) => new ZodModel('AnimalTraitsLookup', AnimalTraitsLookupSchema),
    })
    .search({
        filters: (h) => new ZodModel('AnimalTraitsFilters', AnimalTraitsFiltersSchema),
        sort: (h) => new ZodModel('AnimalTraitsSort', AnimalTraitsSortSchema),
        summary: (h) => new ZodModel('AnimalTraitsSummary', AnimalTraitsSummarySchema),
    })

export type IAnimalTraitSchema = typeof AnimalTraitsSchema
