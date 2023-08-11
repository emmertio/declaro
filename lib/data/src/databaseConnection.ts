import type { IDatastoreProvider, BaseModel, BaseModelClass } from '@declaro/core'
import type { EntityManager, Reference } from '@mikro-orm/core'
import type { EntityRepository } from '@mikro-orm/postgresql'
import { Hydrator } from "./hydrateEntity";


export class DatabaseConnection<T extends BaseModel<any>> implements IDatastoreProvider<T> {

    private repository : EntityRepository<any>

    public static inject = ['EntityManager', 'Reference'] as const;

    private em: EntityManager;
    private hydrator: Hydrator;
    private model: BaseModelClass<T>;

    constructor(em : EntityManager, reference: typeof Reference) {
        this.em = em.fork();
        this.hydrator = new Hydrator(this.em, reference);
    }

    setup(model: BaseModelClass<T>) {
        this.model = model;
        this.repository = this.em.getRepository(model);
    }

    getAll() {
        return this.repository.findAll().catch(e => {
            console.log(e);
        })
    }

    upsert(data: T) {
        const entity = this.hydrator.hydrateEntity<T>(this.model, data);
        return this.repository.upsert(entity).then((o) => {
            return this.em.flush().then(() => {
                return o;
            });
        });
    }
}
