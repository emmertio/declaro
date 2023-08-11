import type { IDatastoreProvider, IDatastoreProviderWithFetch, BaseModel, BaseModelClass, IStore } from "@declaro/core";
import type { FetchFunc } from '@declaro/core';
import { RequestErrorStore } from "./errorStore";

export type TrackedPayload<T extends BaseModel<any>> = {
    model: T,
    requestId: string,
    optimistic?: boolean
}

export abstract class AbstractStore<T extends BaseModel<any>> implements IStore{
    private value: T[] = [];
    private subscribers: Array<(value: T[]) => void> = [];

    public errors = new RequestErrorStore();

    protected constructor(
        protected connection: IDatastoreProvider<T>,
        protected model: BaseModelClass<T>)
    {
        this.connection.setup(this.model);
    }

    subscribe(subscription: (value: T[]) => void): (() => void) {
        // Add the new subscriber to the subscribers array
        this.subscribers.push(subscription);

        // Immediately call the subscription with the current value
        subscription(this.value);

        // Return an unsubscribe function
        return () => {
            // Remove the subscriber from the subscribers array
            this.subscribers = this.subscribers.filter(sub => sub !== subscription);
        };
    }

    setFetch(fetch: FetchFunc) {
        const connectionWithFetch = this.connection as IDatastoreProviderWithFetch<T>;

        if (connectionWithFetch.setFetch) {
            connectionWithFetch.setFetch(fetch);
        }
    }

    set(value: T[]) {
        // Update the current value
        this.value = value;

        // Notify all subscribers of the new value
        this.subscribers.forEach(sub => sub(value));
    }

    get(id: string|number, field?: string) {
        if (typeof this.value == 'undefined') {
            return null;
        }
        return this.value.filter((i: T) => {
            if (typeof field !== 'undefined' && (i as any)[field] !== undefined) {
                return (i as any)[field] == id;
            } else {
                return i.id == id;
            }
        });
    }

    getAll() {
        return this.value;
    }

    async hydrate(): Promise<void> {
        const v = await this.connection.getAll();
        this.set(v);
    }

    async upsert(model: T, optimistic: boolean = false): Promise<T> {
        const obj = Object.assign(new this.model(), model);
        if (optimistic) {
            this.insertIntoStore(obj);
        }

        const updated: T = await this.connection.upsert(obj);
        this.insertIntoStore(updated);

        return updated;
    }

    async trackedUpsert(payload: TrackedPayload<T>): Promise<T> {
        try {
            return await this.upsert(payload.model);
        } catch (e) {
            this.errors.push({ requestId: payload.requestId, message: e.message })
        }
    }

    insertIntoStore(obj: T) {
        const exists = this.value.some((i: T) => i.id === obj.id);
        if (exists) {
            this.set(this.value.map((i: T) => i.id === obj.id ? obj : i));
        } else {
            this.set([...this.value, obj]);
        }
    }
}

// this is useful for dynamic references to methods on concrete extensions of this class
export type ActionableStore = AbstractStore<BaseModel<never>> & {
    [key: string]: (...args: any[]) => any;
};
