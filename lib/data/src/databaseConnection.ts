import { IDatastoreProvider } from '@declaro/core'
import { EntityManager } from '@mikro-orm/core'
import { EntityRepository } from '@mikro-orm/postgresql'
import { BaseModel } from './baseModel'
type ModelClass = new (...args: any[]) => BaseModel;

export class DatabaseConnection implements IDatastoreProvider<[ModelClass], BaseModel> {

    private repository : EntityRepository<any>

    public static inject = ['EntityManager'] as const;

    private em: EntityManager;

    constructor(em : EntityManager) {
        this.em = em.fork();
    }

    setup(model: ModelClass) {
        this.repository = this.em.getRepository(model);
    }

    getAll() {
        return this.repository.findAll().catch(e => {
            console.log(e);
        })
    }

    upsert(model: BaseModel) {
        let p;
        if (typeof model.id === 'undefined') {
            p = this.em.insert(model).then(id => {
                return this.repository.findOne(id);
            });
        } else {
            p = this.em.upsert(model);
        }
        return p.then((o) => {
            return this.em.flush().then(() => {
                return o;
            });
        });
    }
}
