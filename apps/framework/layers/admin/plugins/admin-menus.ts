import { useAdminMenuStore } from '../stores/admin-menu.store'

export default defineNuxtPlugin(() => {
    const adminMenuStore = useAdminMenuStore()

    adminMenuStore.registerMenuItem({
        id: 'admin.home',
        label: 'Home',
        icon: 'mdi:home',
        to: '/admin',
        weight: 999,
    })
})
