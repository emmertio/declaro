import type { IDatastoreProvider, IDatastoreProviderWithFetch, BaseModel, BaseModelClass, IStore } from "@declaro/core";
import type { FetchFunc } from '@declaro/core';
import { TrackedStatusStore } from "./trackedStatus";
import type { FilterQuery } from "@mikro-orm/core";

export type TrackedPayload<T> = {
    model: T,
    requestId: string,
    optimistic?: boolean
}

export type UpsertReturnType<T> = T extends (infer U)[] ? U[] : T;
export type RemoveReturnType = (number|string)[] | number | string | null;

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

    async upsert(model: T | T[], optimistic: boolean = false): Promise<UpsertReturnType<T>> {
        if (Array.isArray(model)) {
            const objArray = model.map(m => Object.assign(new this.model(), m));
            if (optimistic) {
                objArray.forEach(obj => this.insertIntoStore(obj));
            }

            const updatedArray: T[] = await this.connection.upsert(objArray);
            updatedArray.forEach(obj => this.insertIntoStore(obj));

            return updatedArray as UpsertReturnType<T>;
        } else {
            const obj = Object.assign(new this.model(), model);
            if (optimistic) {
                this.insertIntoStore(obj);
            }

            const updated: T = await this.connection.upsert(obj);
            this.insertIntoStore(updated);

            return updated as UpsertReturnType<T>;
        }
    }

    async remove(model: T | T[], optimistic: boolean = false): Promise<RemoveReturnType> {
        if (Array.isArray(model)) {
            const objArray = model.map(m => Object.assign(new this.model(), m));
            if (optimistic) {
                objArray.forEach(obj => this.removeFromStore(obj));
            }

            const result: RemoveReturnType = await this.connection.remove(objArray);
            objArray.forEach(obj => this.removeFromStore(obj));
            return result;
        } else {
            const obj = Object.assign(new this.model(), model);
            if (optimistic) {
                this.removeFromStore(obj);
            }

            const result: RemoveReturnType = await this.connection.remove(obj);
            this.removeFromStore(obj);
            return result;
        }
    }

    async trackedUpsert(payload: TrackedPayload<T | T[]>): Promise<UpsertReturnType<T>> {
        try {
            const ret = await this.upsert(payload.model);
            this.trackedStatus.push({ requestId: payload.requestId, error: false, message: 'Upserted successfully' });
            return ret;
        } catch (e) {
            this.trackedStatus.push({ requestId: payload.requestId, error: true, message: e.message });
        }
    }

    async trackedRemove(payload: TrackedPayload<T | T[]>): Promise<RemoveReturnType> {
        try {
            const ret = await this.remove(payload.model);
            this.trackedStatus.push({ requestId: payload.requestId, error: false, message: 'Removed successfully' });
            return ret;
        } catch (e) {
            this.trackedStatus.push({ requestId: payload.requestId, error: true, message: e.message });
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

    removeFromStore(obj: T) {
        this.set(this.value.filter((i: T) => i.id !== obj.id));
    }
}

// this is useful for dynamic references to methods on concrete extensions of this class
export type ActionableStore = AbstractStore<BaseModel<any>> & {
    [key: string]: (...args: any[]) => any;
};
