import type { IDatastoreProvider, BaseModel, BaseModelClass } from '@declaro/core'
import type { EntityManager, FilterQuery, Reference } from "@mikro-orm/core";
import type { EntityRepository } from '@mikro-orm/postgresql'
import { Hydrator } from "./hydrateEntity";
import type { RemoveReturnType, UpsertReturnType } from "./datastoreAbstract";

export type DatabaseConnectionOptions = {
    populate?: string[];
    immutableFields?: string[];
};


export class DatabaseConnection<T extends BaseModel<any>> implements IDatastoreProvider<T> {

    private repository : EntityRepository<any>

    public static inject = ['EntityManager', 'Reference'] as const;

    public readonly em: EntityManager;
    private hydrator: Hydrator;
    private populate;
    private immutableFields = [];

    constructor(em : EntityManager, reference: typeof Reference) {
        this.em = em;
        this.hydrator = new Hydrator(this.em, reference);
    }

    setup(model: BaseModelClass<T>, options: DatabaseConnectionOptions) {
        this.repository = this.em.getRepository(model);
        this.populate = options?.populate;
        if (options?.immutableFields) {
            this.immutableFields = options.immutableFields;
        }
    }

    getAll() {
        return this.repository.findAll({populate: this.populate}).catch(e => {
            console.log(e);
        })
    }

    getWhere(filter?: FilterQuery<any>) {
        return this.repository.find(filter, {populate: this.populate}).catch(e => {
            console.log(e);
        })
    }

    get(id: string | number) {
        return this.repository.findOne(id, {populate: this.populate}).catch(e => {
            console.log(e);
        })
    }

    async upsert<T extends BaseModel<any> | BaseModel<any>[]>(data: T): Promise<UpsertReturnType<T>> {
        if (Array.isArray(data)) {
            const entities: BaseModel<any>[] = [];

            for (const singleData of data) {
                const entity = await this.singleUpsert(singleData);
                entities.push(entity);
            }

            return entities as UpsertReturnType<T>;
        } else {
            return await this.singleUpsert(data) as UpsertReturnType<T>;
        }
    }

    private async singleUpsert<T extends BaseModel<any>>(data: T) {
        let entity: T;

        // Get entity metadata
        const meta = this.em.getMetadata().get(data.constructor.name);

        // Create a shallow copy of data, excluding m:n fields
        const shallowData: Partial<T> = {};
        Object.keys(data).forEach((key) => {
            const property = meta.properties[key];
            if (property && property.reference !== 'm:n') {
                shallowData[key] = data[key];
            }
        });

        if (!data.id) {
            // Create new entity with shallow data
            entity = this.em.create(data.constructor.name, shallowData as any);
            await this.em.persist(entity).flush();
        } else {
            // Fetch and merge for existing entity
            entity = await this.em.findOneOrFail(data.constructor.name, data.id);

            this.immutableFields.forEach(f => {
                if (f in data) {
                    data[f] = entity[f];
                }
            });
            // Use em.assign to properly handle m:n relationships for both new and existing entities
            this.em.assign(entity, data);

            await this.em.persist(entity).flush();
        }

        return entity;
    }

    async remove(data: T[] | T): Promise<RemoveReturnType> {
        if (Array.isArray(data)) {
            const removedIds: (number|string)[] = [];
            for (const singleData of data) {
                if(await this.singleRemove(singleData)) {
                    removedIds.push(singleData.id);
                }
            }
            return removedIds;
        } else {
            return await this.singleRemove(data) ? data.id : null;
        }
    }

    private async singleRemove<T extends BaseModel<any>>(data: T): Promise<boolean> {
        try {
            const entity = await this.em.findOneOrFail(data.constructor.name, data.id);
            await this.em.remove(entity).flush();
            return true;
        } catch (e) {
            if (e.constructor.name === 'NotFoundError') {
                return false;
            } else {
                throw e;
            }
        }
    }
}
