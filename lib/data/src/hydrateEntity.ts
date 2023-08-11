import type { EntityManager, Reference, EntityProperty } from "@mikro-orm/core";
import type { BaseModel } from "@declaro/core";
import type { EntitySchema } from "@mikro-orm/core";

export class Hydrator {
  constructor(
    private readonly em: EntityManager,
    private readonly reference: typeof Reference,
  ) {}

  hydrateEntity<T extends BaseModel<any>>(
    entity: T
  ): BaseModel<T> {
    const metadata = this.em.getMetadata().get(entity.constructor.name);

    for (const prop in entity) {
      const property: EntityProperty = metadata.properties[prop];

      // Check if this property is a relation (ManyToOne, OneToOne, etc.)
      if (
        entity[prop] !== undefined
        && entity[prop] !== null
        && property && ['m:1', '1:1'].includes(property.reference)
      ) {
        // in EntitySchema mode Mikro allows the entity to be another schema instead of an EntityName
        const entitySchema = property.entity() as EntitySchema;

        // this is force to an 'any' here because Mikro can understand a 'Reference' on an instance of our entity
        // even when it's our native entity instead of a Mikro entity (User vs Entity<User>)
        entity[prop] = this.reference.createFromPK(entitySchema.meta.class, entity[prop]) as any;
      }
    }

    return entity;
  }
}
