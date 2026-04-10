// Elephant Traits Schema inheriting from Animal Traits Schema

import z4 from 'zod/v4'
import { ModelSchema } from '@declaro/core'
import { ZodModel } from '@declaro/zod'
import {
    AnimalTraitsDetailSchema,
    AnimalTraitsFiltersSchema,
    AnimalTraitsLookupSchema,
    AnimalTraitsSortSchema,
    AnimalTraitsSummarySchema,
} from './animal-trait-schema'
import { ElephantDetailSchema, ElephantSummarySchema } from './elephant-schema'

export const ElephantTraitsDetailSchema = z4.object({
    ...AnimalTraitsDetailSchema.shape,
    isSharp: z4.boolean(),
    length: z4.number(),
    get animal() {
        return ElephantDetailSchema.optional()
    },
})

export const ElephantTraitsSummarySchema = z4.object({
    ...AnimalTraitsSummarySchema.shape,
    isSharp: z4.boolean(),
    length: z4.number(),
    get animal() {
        return ElephantSummarySchema.optional()
    },
})

export const ElephantTraitsLookupSchema = z4.object({
    ...AnimalTraitsLookupSchema.shape,
})

export const ElephantTraitsFiltersSchema = z4.object({
    ...AnimalTraitsFiltersSchema.shape,
    isSharp: z4.boolean().optional(),
})

export const ElephantTraitsSchema = ModelSchema.create('ElephantTraitsSchema')
    .read({
        detail: (h) => new ZodModel('ElephantTraitsDetail', ElephantTraitsDetailSchema),
        lookup: (h) => new ZodModel('ElephantTraitsLookup', ElephantTraitsLookupSchema),
    })
    .search({
        filters: (h) => new ZodModel('ElephantTraitsFilters', ElephantTraitsFiltersSchema),
        sort: (h) => new ZodModel('ElephantTraitsSort', AnimalTraitsSortSchema),
        summary: (h) => new ZodModel('ElephantTraitsSummary', ElephantTraitsSummarySchema),
    })

export type IElephantTraitSchema = typeof ElephantTraitsSchema
