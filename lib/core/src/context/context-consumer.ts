import { Context } from './context'

export class ContextConsumer<
    C extends Context = Context,
    A extends any[] = any[],
> {
    constructor(protected readonly context: C, ...args: A) {}
}
