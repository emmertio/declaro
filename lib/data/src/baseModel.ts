export abstract class BaseModel {
    protected constructor() {}

    abstract id: string|number;
}

export type BaseModelClass = new (...args: any[]) => BaseModel;