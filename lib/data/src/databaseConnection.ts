import type { IDatastoreProvider, BaseModel, BaseModelClass } from '@declaro/core'
import type { EntityManager, FilterQuery, Reference } from "@mikro-orm/core";
import type { EntityRepository } from '@mikro-orm/postgresql'
import { Hydrator } from "./hydrateEntity";


export class DatabaseConnection<T extends BaseModel<any>> implements IDatastoreProvider<T> {

    private repository : EntityRepository<any>

    public static inject = ['EntityManager', 'Reference'] as const;

    public readonly em: EntityManager;
    private hydrator: Hydrator;
    private populate;

    constructor(em : EntityManager, reference: typeof Reference) {
        this.em = em.fork();
        this.hydrator = new Hydrator(this.em, reference);
    }

    setup(model: BaseModelClass<T>, options) {
        this.repository = this.em.getRepository(model);
        this.populate = options?.populate;
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

    upsert<T extends BaseModel<any>>(data: T) {
        let p;
        const entity = this.hydrator.hydrateEntity<T>(data);

        if (typeof entity.id === 'undefined') {
            p = this.em.insert(entity).then(id => {
                return this.repository.findOne(id);
            });
        } else {
            p = this.repository.upsert(entity);
        }
        return p.then((o: T) => {
            return this.em.flush().then(() => {
                return o;
            });
        });
    }
}
