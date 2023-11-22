import type { IDatastoreProvider, IDatastoreProviderWithFetch, BaseModel, BaseModelClass, IStore } from "@declaro/core";
import type { FetchFunc } from '@declaro/core';
import { TrackedStatusStore } from "./trackedStatus";
import type { FilterQuery } from "@mikro-orm/core";

export type TrackedPayload<T> = {
    model: T,
    requestId: string,
    optimistic?: boolean
}

export abstract class AbstractStore<T extends BaseModel<any>> implements IStore{
    protected value: T[] = [];
    private subscribers: Array<(value: T[]) => void> = [];

    private hydrated = false;

    public trackedStatus = new TrackedStatusStore();

    protected constructor(
      protected connection: IDatastoreProvider<T>,
      protected model: BaseModelClass<T>,
      protected options?: any)
    {
        this.connection.setup(this.model, options);
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

    async get(value: string | number) {
        await this.hydrate(value)

        if (typeof this.value == 'undefined') {
            return null;
        }

        const matches = this.value.filter((i: T) => {
            return i.id == value;
        });
        return matches[0];
    }

    async getWhere(filter?: FilterQuery<any>) {
        await this.hydrate(null, filter);
        return this.value;
    }

    async getAll() {
        await this.hydrate();
        return this.value;
    }

    async hydrate(id?: string | number, filter?: FilterQuery<any>): Promise<void> {
        if (this.hydrated && !filter) {
            return;
        }
        if (filter) {
            const v = await this.connection.getWhere(filter);
            if (v) {
                this.set(v);
            }
        } else if (!id) {
            const v = await this.connection.getAll();
            if (v) {
                this.set(v);
            }
        } else if (!filter) {
            const v = await this.connection.get(id);
            if (v) {
                this.set([v]);
            }
        }
        this.hydrated = true;
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
            const ret = await this.upsert(payload.model);
            console.log(payload.requestId);
            this.trackedStatus.push({ requestId: payload.requestId, error: false, message: 'Completely successfully' })
            return ret;
        } catch (e) {
            this.trackedStatus.push({ requestId: payload.requestId, error: true, message: e.message })
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
