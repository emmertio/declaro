import type { JSONSchema } from '@declaro/core'
import 'zod'

declare module 'zod/v4' {
    /**
     * Custom extension of Zod's GlobalMeta interface.
     * This allows adding custom metadata properties to all Zod schemas.
     */
    export interface GlobalMeta extends JSONSchema {}
}

declare module 'zod' {
    /**
     * Custom extension of Zod's GlobalMeta interface.
     * This allows adding custom metadata properties to all Zod schemas.
     */
    export interface GlobalMeta extends JSONSchema {}
}
