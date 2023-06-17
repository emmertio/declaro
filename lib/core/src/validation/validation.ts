export class Validation<T> {
    public readonly valid: Promise<boolean>
    public readonly value: T

    public get invalid(): Promise<boolean> {
        return new Promise(async (resolve, reject) => {
            const valid = await this.valid
            resolve(!valid)
        })
    }

    constructor(valid: boolean | Promise<boolean>, value: T) {
        this.valid = Promise.resolve(valid)
        this.value = value
    }

    onValid(callback: (value: T) => any): Promise<boolean> {
        const promise = this.valid.then((valid) => {
            if (valid) {
                callback(this.value)
            }
            return valid
        })

        return promise
    }

    onInvalid(callback: (value: T) => any): Promise<boolean> {
        const promise = this.invalid.then((invalid) => {
            if (invalid) {
                callback(this.value)
            }
            return invalid
        })

        return promise
    }
}
