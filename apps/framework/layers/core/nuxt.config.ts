export default defineNuxtConfig({
    compatibilityDate: '2024-04-03',
    devtools: { enabled: true },
    modules: ['@pinia/nuxt', '@nuxt/icon'],
    pinia: {
        storesDirs: ['**/stores/**', 'stores/**', '**/store/**', 'store/**'],
    },
    icon: {
        serverBundle: {
            collections: ['mdi'],
        },
    },
})
