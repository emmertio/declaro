import fetch from 'node-fetch'
type FetchFunc = typeof fetch;

export interface IDatastoreProvider<TSetup extends any[], TModel> {
    getAll() : Promise<any>

    setup: (...args: TSetup) => void;

    upsert: (model: TModel) => Promise<any>;
}

export interface IDatastoreProviderWithFetch<TSetup extends any[], TModel> extends IDatastoreProvider<TSetup, TModel> {
    setFetch?: (fetch: FetchFunc) => void;
}
