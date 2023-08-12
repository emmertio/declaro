import { type Model } from '@declaro/core'

export type ModelConfig = {
    outputDirectory: string
    paths: string[]
    generators: IModelGenerator[]
}

export type IModelGenerator = {
    generateModels(models: Model[], config: ModelConfig): Promise<any>
}
