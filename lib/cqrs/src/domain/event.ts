import { ZodType } from 'zod'
import type { IError } from '@declaro/core/src/typescript/errors'
import type { Class } from '@declaro/core/src/typescript'

export interface IEvent<Name extends string = string> {
    readonly $name: Name
    serialize(): any
    validate(): boolean
}

export type EventRef<Name extends string> = Name
export type EventRefName<Ref extends EventRef<any>> = Ref extends Class<IEvent>
    ? InstanceType<Ref>['$name']
    : Ref extends string
    ? Ref
    : never

export interface IEventValidationResult {
    success: boolean
    errors: IError[]
    errorMessage: string
}
