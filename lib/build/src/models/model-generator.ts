import { Model } from '@declaro/core'

export type IModelGenerator = {
    generateModel(model: Model): Promise<string>
}
