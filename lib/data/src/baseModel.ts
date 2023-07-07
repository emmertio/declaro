export abstract class BaseModel {
    public constructor() {}

    abstract id: string|number;
}

export type BaseModelClass = new (...args: any[]) => BaseModel;