import { type Config } from 'tailwindcss'

const config = {
    content: [
        './components/**/*.{js,vue,ts}',
        './layouts/**/*.vue',
        './pages/**/*.vue',
        './plugins/**/*.{js,ts}',
        './content/**/*.md',
        './app.vue',
        './error.vue',
    ],
    theme: {
        extend: {},
    },
    plugins: [require('@tailwindcss/typography')],
} satisfies Config

export default config
