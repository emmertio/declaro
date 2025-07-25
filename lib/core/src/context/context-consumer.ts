import { Context } from './context'

/**
 * @deprecated Inject dependencies directly into the constructor of the class that needs them.
 */
export class ContextConsumer<C extends Context = Context, A extends any[] = any[]> {
    constructor(protected readonly context: C, ...args: A) {}
}
