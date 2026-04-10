import { Context, type ContextListener } from '../context/context'
import type { IEvent } from '../events'
import { App } from './app'

export function onInit<C extends Context>(context: C, listener: ContextListener<C, IEvent>) {
    context.on(App.Events.Init, listener)
}

export function onStart<C extends Context>(context: C, listener: ContextListener<C, IEvent>) {
    context.on(App.Events.Start, listener)
}

export function onDestroy<C extends Context>(context: C, listener: ContextListener<C, IEvent>) {
    context.on(App.Events.Destroy, listener)
}
