type FetchFunc = typeof globalThis.fetch;
import { type BaseModelClass } from '../typescript'

export interface IDatastoreProvider<TModel> {
    getAll() : Promise<void | TModel[]>

    setup: (modelClass: BaseModelClass<TModel>) => void;

    upsert: (model: TModel) => Promise<any>;
}

export interface IDatastoreProviderWithFetch<TModel> extends IDatastoreProvider<TModel> {
    setFetch?: (fetch: FetchFunc) => void;

    _callStoreMethod: (method: string, httpMethod: string, payload: any) => Promise<any>;
}
