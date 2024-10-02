import { createNavStore } from '~/layers/core/utils/nav/create-nav-store'

export const useAdminMenuStore = defineStore('admin-menu', () => {
    return createNavStore()
})
