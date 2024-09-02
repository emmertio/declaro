import type { MenuItem } from './menu-definition'

export function createNavStore() {
    // Menu Items
    const menu = ref<MenuItem[]>([])

    function setMenu(items: MenuItem[]) {
        menu.value = items
    }

    function registerMenuItem(item: MenuItem) {
        const itemExists = menu.value.some((i) => i.id === item.id)

        if (itemExists) {
            menu.value = menu.value
                .map((i) => (i.id === item.id ? item : i))
                .sort((a, b) => (b.weight || 0) - (a.weight || 0))
        } else {
            menu.value = [...menu.value, item].sort((a, b) => (b.weight || 0) - (a.weight || 0))
        }

        return menu.value
    }

    function removeMenuItem(id: string) {
        menu.value = menu.value.filter((i) => i.id !== id)
    }

    // Menu Open State
    const isOpen = ref(false)

    function toggle() {
        isOpen.value = !isOpen.value
    }

    function open() {
        isOpen.value = true
    }

    function close() {
        isOpen.value = false
    }

    return {
        menu,
        setMenu,
        registerMenuItem,
        removeMenuItem,
        isOpen,
        toggle,
        open,
        close,
    }
}
