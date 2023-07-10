export type Class<T extends {} = {}, A extends any[] = any[]> = {
    new (...args: A): T
}