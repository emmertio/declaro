// https://nuxt.com/docs/api/configuration/nuxt-config
import spec from './openapi.json'

export default defineNuxtConfig({
    extends: ['./layers/auth', './layers/core', './layers/admin', './layers/schema'],
    compatibilityDate: '2024-04-03',
    devtools: { enabled: true },
    modules: ['@nuxtjs/tailwindcss', '@nuxtjs/storybook', '@pinia/nuxt', '@nuxt/icon', '@scalar/nuxt'],
    tailwindcss: {
        cssPath: '~/assets/css/tailwind.css',
        configPath: 'tailwind.config.js',
        viewer: true,
    },
    scalar: {
        spec: {
            content: { ...spec, servers: [{ url: 'http://localhost:3000/api/model' }] },
        },
    },
})
