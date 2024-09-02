import type { NuxtLinkProps } from '#app'

export type MenuItem = NuxtLinkProps & {
    /**
     * Unique identifier for the menu item
     */
    id: string

    /**
     * Label of the menu item (Visible on the menu)
     */
    label: string

    /**
     * Icon of the menu item
     */
    icon?: string

    /**
     * Weight of the menu item (Used for sorting)
     */
    weight?: number

    /**
     * Nested menu items
     */
    children?: MenuItem[]
}
