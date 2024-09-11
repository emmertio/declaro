import { InterfaceModelGenerator, ReferenceGenerator, declaro } from '@declaro/build'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },

  serverHandlers: [
      {
          route: '/api',
          handler: '~/api/index.ts',
          middleware: true,
      },
  ],

  vite: {
      plugins: [
          // declaro({
          //     models: {
          //         generators: [new ReferenceGenerator(), new InterfaceModelGenerator()],
          //     },
          // }),
      ],
  },

  alias: {
      '@D': '../.declaro',
  },

  compatibilityDate: '2024-08-06',
})