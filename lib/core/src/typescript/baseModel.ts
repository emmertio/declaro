export abstract class BaseModel<TId> {
    public constructor() {}

    abstract id?: TId;
}

export type BaseModelClass<T> = new (values?: Partial<T>) => T;
