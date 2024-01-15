export enum PermissionRuleType {
    ALL_OF = 'ALL_OF',
    NONE_OF = 'NONE_OF',
    SOME_OF = 'SOME_OF',
}

export type PermissionRule = {
    type: PermissionRuleType
    permissions: string[]
    errorMessage: string
}

export class PermissionError extends Error {
    constructor(
        message: string,
        public rule: PermissionRule,
        public permissions: string[],
    ) {
        super(message ?? 'Permission Error')
    }
}

export type PermissionValidationResults = {
    valid: boolean
    errorMessage: string
    errors: PermissionError[]
}

export class PermissionValidator {
    readonly rules: PermissionRule[] = []
    static create() {
        return new PermissionValidator()
    }

    addRule(...rule: PermissionRule[]) {
        this.rules.push(...rule)
        return this
    }

    extend(...validators: PermissionValidator[]) {
        validators.forEach((validator) => {
            this.rules.push(...validator.rules)
        })
        return this
    }

    allOf(permissions: string[], errorMessage?: string) {
        this.addRule({
            type: PermissionRuleType.ALL_OF,
            permissions,
            errorMessage,
        })
        return this
    }

    noneOf(permissions: string[], errorMessage?: string) {
        this.addRule({
            type: PermissionRuleType.NONE_OF,
            permissions,
            errorMessage,
        })
        return this
    }

    someOf(permissions: string[], errorMessage?: string) {
        this.addRule({
            type: PermissionRuleType.SOME_OF,
            permissions,
            errorMessage,
        })
        return this
    }

    private validateRule(rule: PermissionRule, permissions: string[]) {
        if (rule.type === PermissionRuleType.ALL_OF) {
            return rule.permissions.every(
                (permission) => permissions.indexOf(permission) > -1,
            )
        } else if (rule.type === PermissionRuleType.NONE_OF) {
            return !rule.permissions.some(
                (permission) => permissions.indexOf(permission) > -1,
            )
        } else if (rule.type === PermissionRuleType.SOME_OF) {
            return rule.permissions.some(
                (permission) => permissions.indexOf(permission) > -1,
            )
        } else {
            throw new Error(`Invalid permission rule type ${rule.type}`)
        }
    }

    validate(permissions: string[]) {
        return this.rules.reduce((status, rule) => {
            const valid = this.validateRule(rule, permissions)

            if (!valid) {
                throw new PermissionError(rule.errorMessage, rule, permissions)
            }

            return status && valid
        }, true)
    }

    safeValidate(permissions: string[]): PermissionValidationResults {
        const errors = this.rules
            .map((rule) => {
                const valid = this.validateRule(rule, permissions)

                if (!valid) {
                    return new PermissionError(
                        rule.errorMessage,
                        rule,
                        permissions,
                    )
                } else {
                    return undefined
                }
            })
            .filter((item) => !!item)

        if (errors.length > 0) {
            return {
                valid: false,
                errorMessage: errors[0].message,
                errors,
            }
        } else {
            return {
                valid: true,
                errorMessage: '',
                errors: [],
            }
        }
    }
}
