import { IDatastoreProviderWithFetch } from '@declaro/core'
import { BaseModel } from './baseModel'
import type { FetchFunc } from '@declaro/core'

type ModelClass = new (...args: any[]) => BaseModel;

export class ServerConnection implements IDatastoreProviderWithFetch<[ModelClass], BaseModel> {

    private fetch: FetchFunc;
    private model: ModelClass;

    setup(model: ModelClass) {
        this.model = model;
    }

    setFetch(fetch: FetchFunc) {
        this.fetch = fetch;
    }

    getAll(): Promise<any> {
        return this.fetch(`/store/${this.model.name}/getAll`).then(r => {
            return r.json().then((objs: any[]) => {
                let a = objs.map(o => Object.assign(new this.model(), o));
                return a;
            });
        });
    }

    upsert(model: BaseModel): Promise<any> {
        return this.fetch(
            `/store/${this.model.name}/upsert`,
            {
                method: 'POST',
                body: JSON.stringify(model),
                headers: {
                    "Content-Type": "application/json",
                }
            }
        );
    }
}
