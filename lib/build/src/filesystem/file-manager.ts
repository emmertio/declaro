import fs from 'fs'
import { resolve } from 'path'
import { type PluginConfig } from '../config/plugin-config'
import { type FilterPattern, createFilter } from 'vite'

export class FileManager {
    static inject = ['PluginConfig'] as const
    readonly projectDirectory: string
    readonly companionDirectory: string
    constructor(protected readonly config: PluginConfig) {
        this.projectDirectory = config.viteConfig.root
        this.companionDirectory = resolve(config.viteConfig.root, '.declaro')
    }

    async prepareFilesystem() {
        await this.prepareCompanionDirectory()
        await Promise.all([this.prepareAssetDirectory('models')])
    }

    async prepareCompanionDirectory() {
        if (!fs.existsSync(this.companionDirectory)) {
            fs.mkdirSync(this.companionDirectory)
        }
    }

    async prepareAssetDirectory(dir: string) {
        const assetDirectory = resolve(this.companionDirectory, dir)
        if (!fs.existsSync(assetDirectory)) {
            fs.mkdirSync(assetDirectory)
        }
    }

    pathMatches(needle: string, haystack: FilterPattern) {
        const filter = createFilter(haystack, null, {
            resolve: this.projectDirectory,
        })
        return filter(needle)
    }
}
