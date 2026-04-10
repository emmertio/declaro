/**
 * Base scope interfaces for @declaro/core
 *
 * Users can augment these interfaces by creating their own declaration file:
 *
 * ```typescript
 * // types/scope.d.ts
 * declare module '#scope' {
 *   interface AppScope {
 *     // Add your app-level scope properties
 *     config: MyAppConfig
 *   }
 *
 *   interface RequestScope {
 *     // Add your request-level scope properties
 *     user: User
 *   }
 * }
 * ```
 */

/**
 * Base application scope interface.
 * This represents data that is available throughout the entire application lifecycle.
 */
export interface AppScope {}

/**
 * Base request scope interface.
 * This represents data that is available for the duration of a single request.
 * Extends AppScope to inherit application-level data.
 */
export interface RequestScope extends AppScope {}
