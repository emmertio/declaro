// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    extends: ['./layers/core', './layers/admin', './layers/schema'],
    compatibilityDate: '2024-04-03',
    devtools: { enabled: true },
    modules: ['@nuxtjs/tailwindcss', '@nuxtjs/storybook', '@pinia/nuxt', '@nuxt/icon'],
    tailwindcss: {
        cssPath: '~/assets/css/tailwind.css',
        configPath: 'tailwind.config.js',
        viewer: true,
    },
})