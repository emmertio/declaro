type FetchFunc = typeof globalThis.fetch;
import { type BaseModelClass } from '../typescript'
import type { FilterQuery } from "@mikro-orm/core";

export interface IDatastoreProvider<TModel> {
    getAll() : Promise<void | TModel[]>

    getWhere(options: FilterQuery<any>): Promise<void | TModel[]>

    get(id: string | number) : Promise<void | TModel>

    setup: (modelClass: BaseModelClass<TModel>, options?: any) => void;

    upsert: (model: TModel | TModel[]) => Promise<any>;

    remove: (model: TModel | TModel[]) => Promise<(number|string)[] | number | string | null>;
}

export interface IDatastoreProviderWithFetch<TModel> extends IDatastoreProvider<TModel> {
    setFetch?: (fetch: FetchFunc) => void;

    _callStoreMethod: (method: string, httpMethod: string, payload: any) => Promise<any>;
}
