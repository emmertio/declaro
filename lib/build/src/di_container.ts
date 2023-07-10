import { Scope, createInjector } from 'typed-inject'
import { FileManager } from './generation/file-manager'
import { PluginConfig } from './config/plugin-config'

const injector = createInjector()
    .provideValue('PluginConfig', new PluginConfig())
    .provideClass('FileManager', FileManager, Scope.Singleton)

export { injector }
