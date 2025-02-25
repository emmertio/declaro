import { Context, type ContextListener } from '../context/context'
import { App } from './app'

export function onInit(context: Context, listener: ContextListener) {
    context.on(App.Events.Init, listener)
}

export function onStart(context: Context, listener: ContextListener) {
    context.on(App.Events.Start, listener)
}

export function onDestroy(context: Context, listener: ContextListener) {
    context.on(App.Events.Destroy, listener)
}
