export async function sleep(duration: number) {
    return await new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve(undefined)
        }, duration)
    })
}
