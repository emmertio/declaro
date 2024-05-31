import { InterfaceModelGenerator, ReferenceGenerator, declaro } from '@declaro/build'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    devtools: { enabled: true },
    serverHandlers: [
        {
            route: '/api',
            handler: '~/server/index.ts',
            middleware: true,
        },
    ],
    vite: {
        plugins: [
            declaro({
                models: {
                    generators: [new ReferenceGenerator(), new InterfaceModelGenerator()],
                },
            }),
        ],
    },
})
