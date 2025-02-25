import { Context, type ContextMiddleware, type ContextListener } from '../context/context'
import { onDestroy, onInit, onStart } from './app-lifecycle'

export type AppConfig = {
    context?: Context
    init?: ContextMiddleware
    start?: ContextMiddleware
    destroy?: ContextMiddleware
}

export class App {
    constructor(public readonly context: Context) {}

    static Events = {
        Init: 'declaro:init',
        Start: 'declaro:start',
        Destroy: 'declaro:destroy',
    }

    async init() {
        await this.context.emit(App.Events.Init)
    }

    onInit(listener: ContextListener) {
        onInit(this.context, listener)
        return this
    }

    async start() {
        await this.context.emit(App.Events.Start)
    }

    onStart(listener: ContextListener) {
        onStart(this.context, listener)
        return
    }

    async destroy() {
        await this.context.emit(App.Events.Start)
    }

    onDestroy(listener: ContextListener) {
        onDestroy(this.context, listener)
    }
}
