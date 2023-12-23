import vue from '@vitejs/plugin-vue'
import ssr from 'vike/plugin'
import { UserConfig, Plugin } from 'vite'
import { declaro, ReferenceGenerator } from '@declaro/build'
import { MikroORMEntityGenerator } from '@declaro/data'

const config: UserConfig = {
    mode: 'development',
    plugins: [
        declaro({
            models: {
                generators: [
                    new ReferenceGenerator(),
                    new MikroORMEntityGenerator(),
                ],
            },
        }),
        vue(),
        ssr(),
    ],
}

export default config
