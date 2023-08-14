import type { JSONified } from "@declaro/data";

export abstract class BaseModel<TId> {
    public constructor() {}

    abstract id: TId;

    toJSON<T extends BaseModel<TId>>(): JSONified<T> {
        let output: any = {};
        for (let key in this) {
            if (this.hasOwnProperty(key)) {
                if (this[key] instanceof BaseModel) {
                    output[key] = (this[key] as BaseModel<any>).id;
                } else {
                    output[key] = this[key];
                }
            }
        }
        return output;
    }
}

export type BaseModelClass<T> = new (values?: Partial<T>) => T;
