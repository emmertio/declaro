import type { Application } from './application'
import type { DeclaroSchema } from './types'
import _ from 'lodash-es'

export class Module {
    constructor(public readonly application: Application, public readonly tag: DeclaroSchema.TagObject) {}
}
