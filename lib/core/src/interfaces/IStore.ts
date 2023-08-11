export interface IStore {
    subscribe: (subscription: (value: any) => void) => () => void
    set?: (value: any) => void
}
