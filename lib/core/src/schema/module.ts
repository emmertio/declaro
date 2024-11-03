import type { Application } from './application'
import type { DeclaroSchema } from './types'

export class Module {
    constructor(public readonly application: Application, public readonly tag: DeclaroSchema.TagObject) {}
}
