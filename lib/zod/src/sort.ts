import { z } from 'zod/v4'

export function sortParameter() {
    return z.enum(['asc', 'desc', 'asc nulls first', 'asc nulls last', 'desc nulls first', 'desc nulls last'])
}

export type SortParameterDef = ReturnType<typeof sortParameter>
export type SortParameter = z.infer<SortParameterDef>

export type SortObjectShape<K extends string> = {
    [Key in K]: z.ZodOptional<SortParameterDef>
}

const obj = {} as z.ZodObject<SortObjectShape<'foo' | 'bar'>>

export function sortObject<K extends string>(keys: K[]): z.ZodObject<SortObjectShape<K>> {
    const shape = keys.reduce((acc, key) => {
        acc[key] = sortParameter().optional()
        return acc
    }, {} as SortObjectShape<K>)
    return z.object(shape)
}

export function sortArray<K extends string>(keys: K[]): z.ZodArray<z.ZodObject<SortObjectShape<K>>> {
    return z.array(sortObject(keys))
}
