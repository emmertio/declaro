import type { IDatastoreProviderWithFetch, BaseModel, BaseModelClass } from '@declaro/core'
import type { FetchFunc } from '@declaro/core'

export class ServerConnection<T extends BaseModel<any>> implements IDatastoreProviderWithFetch<T> {

    private fetch: FetchFunc;
    private model: BaseModelClass<T>;

    setup(model: BaseModelClass<T>) {
        this.model = model;
    }

    setFetch(fetch: FetchFunc) {
        this.fetch = fetch;
    }

    getAll(): Promise<any> {
        return this.fetch(`/store/${this.model.name}/getAll`).then(r => {
            return r.json().then((objs: any[]) => {
                // turn results back into objects of the correct type
                return objs.map(o => Object.assign(new this.model(), o));
            });
        });
    }

    upsert(model: T): Promise<any> {
        return this._callStoreMethod('upsert', 'POST', model);
    }

    _callStoreMethod(method: string, httpMethod: string, payload: any = null): Promise<any> {
        let headers = {};

        if (payload) {
            headers['Content-Type'] = 'application/json;'
            headers['Accept'] = 'application/json;'
        }

        return this.fetch(
            `/store/${this.model.name}/${method}`,
            {
                method: httpMethod,
                body: JSON.stringify(payload),
                headers
            }
        ).then(async r => {
            const data = await r.json();
            if (!r.ok) {
                throw Error(data.message);
            } else {
                return data;
            }
        });
    }
}
