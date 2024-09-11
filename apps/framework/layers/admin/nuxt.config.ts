export default defineNuxtConfig({
    extends: ['../core'],
    compatibilityDate: '2024-04-03',
    devtools: { enabled: true },
    app: {
        head: {
            title: 'Admin',
            meta: [
                {
                    name: 'description',
                    content: 'Manage your application',
                },
            ],
        },
    },
})
