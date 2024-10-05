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
    [key in keyof A | keyof B]: key extends keyof B ? B[key] : key extends keyof A ? A[key] : never
}
