import z from 'zod/v4'
import { ZodModel } from '@declaro/zod'
import { ModelSchema } from '@declaro/core'

export const PaginationInput = new ZodModel(
    'PaginationInput' as const,
    z.object({
        page: z.number().int().min(1).default(1).nullish(),
        pageSize: z.number().int().min(1).default(25).nullish(),
    }),
)
export type IPaginationInput = z.infer<typeof PaginationInput.schema>

export const PaginationOutput = new ZodModel(
    'PaginationOutput' as const,
    z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).default(25),
        total: z.number().int().min(0).default(0),
        totalPages: z.number().int().min(1).default(1),
    }),
)
export type IPagination = z.infer<typeof PaginationOutput.schema>

export const PaginationSchema = ModelSchema.create('Pagination').custom({
    input: () => PaginationInput,
    output: () => PaginationOutput,
})
