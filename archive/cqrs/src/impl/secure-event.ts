import { UnsecuredEvent } from './unsecured-event'
import type { IEvent } from '../domain/event'
import type { PermissionValidator } from './auth/permission-validator'

export interface ISecureEvent extends IEvent {
    secured: true

    validatePermissions(permissions: string[]): boolean
}

export abstract class SecureEvent
    extends UnsecuredEvent
    implements ISecureEvent
{
    secured: true

    protected abstract readonly $permissions: PermissionValidator

    validatePermissions(permissions: string[]) {
        return this.$permissions.validate(permissions)
    }

    safeValidatePermissions(permissions: string[]) {
        return this.$permissions.safeValidate(permissions)
    }
}

export abstract class SecureCommand extends SecureEvent {}

export abstract class SecureQuery extends SecureEvent {}
