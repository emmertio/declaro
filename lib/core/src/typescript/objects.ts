export type UnionToIntersection<T> = (T extends any ? (x: T) => any : never) extends (x: infer R) => any ? R : never
export default {}

export type DeepPartial<T> = T extends object
    ? {
          [P in keyof T]?: DeepPartial<T[P]>
      }
    : T

/**
 * Merge two object types without using an intersection type. Intersection types preserve the original types of the objects causing confusion, while this type will merge the types of the objects.
 */
export type Merge<A, B> = {
    [K in keyof A | keyof B]: K extends keyof B
        ? B[K] extends object[] // Support for arrays
            ? K extends keyof A
                ? A[K] extends object[]
                    ? Merge<A[K], B[K]> // If both are arrays, merge them
                    : B[K] // If only B is an array, use B
                : B[K]
            : B[K] extends object
            ? K extends keyof A
                ? A[K] extends object
                    ? Merge<A[K], B[K]>
                    : B[K]
                : B[K]
            : B[K]
        : K extends keyof A
        ? A[K]
        : never
}

/**
 * Shallow merge two object types, replacing types of properties instead of merging them.
 * Properties in B will completely replace properties in A.
 */
export type ShallowMerge<A extends object, B extends object> = {
    [K in UniqueKeys<keyof A, keyof B>]: A[K]
} & {
    [K in keyof B]: B[K]
}

/**
 * Extract keys from A that are not present in B
 */
export type UniqueKeys<A, B> = A extends B ? never : A
