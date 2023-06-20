/**
 * Exclude the first item from a tuple.
 */
export type ExcludeFirstItem<T extends any[]> = T extends [any, ...infer U]
    ? U
    : never
export default {}
