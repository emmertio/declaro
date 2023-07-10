import fs from 'fs'
import { resolve } from 'path'
import { PluginConfig } from '../config/plugin-config'

export class FileManager {
    static inject = ['PluginConfig'] as const

    protected readonly projectDirectory: string
    protected readonly companionDirectory: string

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
            console.log('Creating companion directory')
            fs.mkdirSync(this.companionDirectory)
        } else {
            console.log('Companion directory already exists')
        }
    }

    async prepareAssetDirectory(dir: string) {
        const assetDirectory = resolve(this.companionDirectory, dir)
        if (!fs.existsSync(assetDirectory)) {
            fs.mkdirSync(assetDirectory)
        }
    }
}
