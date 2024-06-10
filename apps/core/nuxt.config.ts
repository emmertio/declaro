import { declaro, ReferenceGenerator, InterfaceModelGenerator } from '@declaro/build'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    devtools: { enabled: true },
    vite: {
        plugins: [
            declaro({
                models: {
                    generators: [new ReferenceGenerator(), new InterfaceModelGenerator()],
                },
            }),
        ],
    },
    alias: {
        '@D': '../.declaro',
    },
    serverHandlers: [
        {
            route: '/api',
            handler: '~/server/index.ts',
            middleware: true,
        },
    ],
})
