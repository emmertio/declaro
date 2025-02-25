import { useHeader } from '../http/headers'
import { Context } from '../context/context'

/**
 * Get the name of the app making the current request via header x-app. (returns "default" when no app was provided).
 *
 * @param context
 * @returns the name of the app in a string.
 */
export function useApp(context: Context) {
    const appHeader = useHeader(context, 'x-app') as string

    return appHeader ?? 'default'
}
