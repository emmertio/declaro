import { ConfigSet } from './setting'

export const siteConfig = new ConfigSet('Site', {
    domain: process.env.APP_DOMAIN ?? 'http://localhost:8080',
    email: process.env.APP_EMAIL ?? 'admin@declaro.io',
})
