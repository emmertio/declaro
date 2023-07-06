import type { IDatastoreProvider, IDatastoreProviderWithFetch } from '@declaro/core';
import type { BaseModel } from './baseModel';
import type { FetchFunc } from '@declaro/core';

export abstract class AbstractStore<T extends BaseModel> {
    private value: T[] = [];
    private subscribers: Array<(value: T[]) => void> = [];

    protected abstract model: new (...args: any[]) => T;

    protected constructor(protected connection: IDatastoreProvider<any[], T>) {}

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
        const connectionWithFetch = this.connection as IDatastoreProviderWithFetch<any[], T>;

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
        console.log(this.value);
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

    async upsert(model: T): Promise<T> {
        const obj = Object.assign(new this.model(), model);
        const updated = await this.connection.upsert(obj);
        this.set(this.value.map((i: T) => i.id === updated.id ? updated : i));

        const exists = this.value.some((i: T) => i.id === updated.id);
        if (exists) {
            this.set(this.value.map((i: T) => i.id === updated.id ? updated : i));
        } else {
            this.set([...this.value, updated]);
        }

        return updated;
    }
}
