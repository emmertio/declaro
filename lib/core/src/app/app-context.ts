import { Context, type RequestScope } from '../context/context'

/**
 * Get the name of the app making the current request via header x-app. (returns "default" when no app was provided).
 *
 * @param context
 * @returns the name of the app in a string.
 */
export function useApp<C extends Context<RequestScope>>(context: C) {
    const appHeader = context.scope.header('x-app')

    return appHeader ?? 'default'
}
