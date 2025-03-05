// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    extends: ['./layers/core', './layers/admin', './layers/schema'],
    compatibilityDate: '2024-04-03',
    devtools: { enabled: true },
    modules: ['@tailwindcss/postcss', '@pinia/nuxt', '@nuxt/icon', '@nuxt/content'],
    css: ['~/assets/styles/main.scss'],
    postcss: {
        plugins: {
            '@tailwindcss/postcss': {
                config: './tailwind.config.ts',
            },
            autoprefixer: {},
        },
    },
    content: {
        build: {
            markdown: {
                toc: {
                    depth: 4,
                },
            },
        },
    },
})
