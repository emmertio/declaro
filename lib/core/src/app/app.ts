import { Context, type ContextMiddleware, type ContextListener } from '../context/context'
import type { IEvent } from '../events'
import { onDestroy, onInit, onStart } from './app-lifecycle'

export type AppConfig = {
    context?: Context
    init?: ContextMiddleware
    start?: ContextMiddleware
    destroy?: ContextMiddleware
}

export class App<C extends Context = Context> {
    constructor(public readonly context: C) {}

    static Events = {
        Init: 'declaro:init',
        Start: 'declaro:start',
        Destroy: 'declaro:destroy',
    }

    async init() {
        await this.context.initializeEagerDependencies()
        await this.context.emit(App.Events.Init)
    }

    onInit(listener: ContextListener<C, IEvent>) {
        onInit(this.context, listener)
        return this
    }

    async start() {
        await this.context.emit(App.Events.Start)
    }

    onStart(listener: ContextListener<C, IEvent>) {
        onStart(this.context, listener)
        return
    }

    async destroy() {
        await this.context.emit(App.Events.Start)
    }

    onDestroy(listener: ContextListener<C, IEvent>) {
        onDestroy(this.context, listener)
    }
}
