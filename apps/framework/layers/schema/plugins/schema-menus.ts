export default defineNuxtPlugin(() => {
    const adminMenuStore = useAdminMenuStore()

    adminMenuStore.registerMenuItem({
        id: 'schema.home',
        label: 'Schema',
        icon: 'mdi:file-tree',
        to: '/admin/schema',
        children: [
            {
                id: 'schema.data-sources',
                label: 'Data Sources',
                to: '/admin/schema/data-sources',
            },
            {
                id: 'schema.models',
                label: 'Data Models',
                to: '/admin/schema',
            },
        ],
    })
})
