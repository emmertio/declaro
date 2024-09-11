export type PromiseOrValue<T> = Promise<T> | T

export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T
