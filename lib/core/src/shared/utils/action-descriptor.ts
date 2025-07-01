import { kebabCase } from 'change-case'

export interface IActionDescriptorInput {
    namespace?: string
    resource?: string
    action?: string
    scope?: string
}

export interface IActionDescriptor {
    namespace: string
    resource: string
    action: string
    scope?: string
}

export class ActionDescriptor implements IActionDescriptor {
    protected readonly descriptor: IActionDescriptorInput

    constructor(input: IActionDescriptorInput) {
        this.descriptor = {}
        this.update(input)
    }

    update(input: IActionDescriptorInput) {
        this.descriptor.namespace = this.parameterize(input.namespace ?? this.descriptor.namespace)
        this.descriptor.resource = this.parameterize(input.resource ?? this.descriptor.resource)
        this.descriptor.action = input.action ?? this.descriptor.action
        this.descriptor.scope = this.parameterize(input.scope ?? this.descriptor.scope)

        return this
    }

    get namespace(): string {
        return this.descriptor.namespace ?? 'global'
    }

    get resource(): string {
        return this.descriptor.resource ?? '*'
    }

    get action(): string {
        return this.descriptor.action ?? '*'
    }

    get scope(): string | undefined {
        return this.descriptor.scope
    }

    toString(): string {
        return `${this.namespace}::${this.resource}.${this.action}${this.scope ? `:${this.scope}` : ''}`
    }

    toJSON(): IActionDescriptor {
        return {
            namespace: this.namespace,
            resource: this.resource,
            action: this.action,
            scope: this.scope,
        }
    }

    parse(input: string): ActionDescriptor {
        let remainder = input.trim()

        const [namespace, ...rest] = remainder.split('::').filter((s) => s.trim() !== '')
        remainder = rest.join('::').trim()

        const [resource, ...rest2] = remainder.split('.').filter((s) => s.trim() !== '')
        remainder = rest2.join('.').trim()

        const [action, ...rest3] = remainder.split(':').filter((s) => s.trim() !== '')
        remainder = rest3.join(':').trim()

        const [scope] = remainder.split(':').filter((s) => s.trim() !== '')

        this.update({
            namespace: namespace,
            resource: resource,
            action: action,
            scope: scope,
        })

        return this
    }

    static fromString(input: string): ActionDescriptor {
        const descriptor = new ActionDescriptor({ namespace: 'global', resource: '*', action: '*' })
        return descriptor.parse(input)
    }

    static fromJSON(json: IActionDescriptorInput): ActionDescriptor {
        return new ActionDescriptor(json)
    }

    protected parameterize(string?: string) {
        if (!string || string === '*') {
            return string
        }
        return kebabCase(string)
    }
}
