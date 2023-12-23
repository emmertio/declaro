import { InjectorBuilder } from '@declaro/core'

export async function getInjector() {
    return InjectorBuilder.create().build()
}
