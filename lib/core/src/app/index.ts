import { ContextMiddleware } from '../context'

export type AppMeta = {
    /**
     * A human-friendly title for your app
     */
    title: string
    /**
     * A unique parameterized name for your app
     */
    name: string
    /**
     * A human-friendly description for your app
     */
    description: string
    /**
     * A URL to a logo for your app
     */
}

export type App = {
    meta: AppMeta
    context: ContextMiddleware
}

export function defineApp(
    meta: AppMeta,
    configureContext: ContextMiddleware,
): App {
    return {
        meta,
        context: configureContext,
    }
}
