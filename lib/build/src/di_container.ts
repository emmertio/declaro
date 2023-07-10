import { Scope, createInjector } from 'typed-inject'
import { FileManager } from './filesystem/file-manager'
import { PluginConfig } from './config/plugin-config'
import { ModelManager } from './models/model-manager'

const injector = createInjector()
    .provideValue('PluginConfig', new PluginConfig())
    .provideClass('FileManager', FileManager, Scope.Singleton)
    .provideClass('ModelManager', ModelManager, Scope.Singleton)

export { injector }
