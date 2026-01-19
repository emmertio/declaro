// Elephant Schema inheriting from Animal Schema

import z4 from 'zod/v4'
import {
    AnimalDetailSchema,
    AnimalFiltersSchema,
    AnimalLookupSchema,
    AnimalSortSchema,
    AnimalSummarySchema,
} from './animal-schema'
import { ModelSchema } from '@declaro/core'
import { ZodModel } from '@declaro/zod'
import { ElephantTraitsDetailSchema, ElephantTraitsSummarySchema } from './elephant-trait-schema'

export const ElephantDetailSchema = z4.object({
    ...AnimalDetailSchema.shape,
    trunkLength: z4.number(),
    get traits() {
        return z4.array(ElephantTraitsDetailSchema)
    },
    get elephantDetails() {
        return z4.object({
            favoriteFood: z4.string(),
            weight: z4.number(),
        })
    },
})

export const ElephantSummarySchema = z4.object({
    ...AnimalSummarySchema.shape,
    trunkLength: z4.number(),
    get traits() {
        return z4.array(ElephantTraitsSummarySchema)
    },
})

export const ElephantLookupSchema = z4.object({
    ...AnimalLookupSchema.shape,
})

export const ElephantFiltersSchema = z4.object({
    ...AnimalFiltersSchema.shape,
    minTrunkLength: z4.number().optional(),
    maxTrunkLength: z4.number().optional(),
})

export const ElephantSchema = ModelSchema.create('ElephantSchema')
    .read({
        detail: (h) => new ZodModel('ElephantDetail', ElephantDetailSchema),
        lookup: (h) => new ZodModel('ElephantLookup', ElephantLookupSchema),
    })
    .search({
        filters: (h) => new ZodModel('ElephantFilters', ElephantFiltersSchema),
        sort: (h) => new ZodModel('ElephantSort', AnimalSortSchema),
        summary: (h) => new ZodModel('ElephantSummary', ElephantSummarySchema),
    })

export type IElephantSchema = typeof ElephantSchema
