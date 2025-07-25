import { Context, type DeclaroRequestScope } from '../context/context'

/**
 * Get the name of the app making the current request via header x-app. (returns "default" when no app was provided).
 *
 * @param context A context that includes DeclaroRequestScope properties
 * @returns the name of the app in a string.
 */
export function useApp<S extends DeclaroRequestScope>(context: Context<S>) {
    const appHeader = context.scope.header('x-app')

    return appHeader ?? 'default'
}
