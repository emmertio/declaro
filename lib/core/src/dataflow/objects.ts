export function merge<T, Source1>(target: T, source1: Source1): T & Source1
export function merge<T, Source1, Source2>(
    target: T,
    source1: Source1,
    source2: Source2,
): T & Source1 & Source2
export function merge<T, Source1, Source2, Source3>(
    target: T,
    source1: Source1,
    source2: Source2,
    source3: Source3,
): T & Source1 & Source2 & Source3
export function merge<T, Source1, Source2, Source3, Source4>(
    target: T,
    source1: Source1,
    source2: Source2,
    source3: Source3,
    source4: Source4,
): T & Source1 & Source2 & Source3 & Source4
export function merge<T, Source1, Source2, Source3, Source4, Source5>(
    target: T,
    source1: Source1,
    source2: Source2,
    source3: Source3,
    source4: Source4,
    source5: Source5,
): T & Source1 & Source2 & Source3 & Source4 & Source5
export function merge(target: any, ...sources: any[]): any[] {
    const recursions = []
    return sources.reduce((workingCopy, source) => {
        return Reflect.ownKeys(source).reduce((workingCopy, key) => {
            let existingValue = workingCopy[key]
            let value = source[key]

            if (Array.isArray(value) && Array.isArray(existingValue)) {
                value = [...existingValue, ...value]
            } else if (Array.isArray(value) && !Array.isArray(existingValue)) {
                value = [existingValue, ...value].filter((item) => !!item)
            } else if (Array.isArray(existingValue) && !Array.isArray(value)) {
                value = [...(existingValue ?? []), value]
            } else if (
                typeof value === 'object' &&
                typeof existingValue === 'object'
            ) {
                value = {
                    ...existingValue,
                    ...value,
                }
            }

            workingCopy[key] = value
            return workingCopy
        }, workingCopy)
    }, target)
}
