import { Plugin } from 'vite'

export function declaro() {
    const plugin: Plugin = {
        name: 'declaro',
        handleHotUpdate(ctx) {
            console.log('handleHotUpdate', ctx.file)
        },
    }

    return [plugin]
}
