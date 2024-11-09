export default defineNuxtConfig({
    modules: ['@nuxt/test-utils/module', '../src/module'],
    myModule: {},
    devtools: { enabled: true },
    compatibilityDate: '2024-11-03',
})
