import type { EntityManager, Reference, EntityClass, EntityProperty } from "@mikro-orm/core";

export class Hydrator {
  constructor(
    private readonly em: EntityManager,
    private readonly reference: typeof Reference
  ) {}

  hydrateEntity<T>(
    entityClass: EntityClass<T>,
    payload: Record<string, any>
  ): Record<string, any> {
    const metadata = this.em.getMetadata().get(entityClass.name);
    const hydrated: Record<string, any> = { ...payload };

    for (const prop in payload) {
      const property: EntityProperty = metadata.properties[prop];

      // Check if this property is a relation (ManyToOne, OneToOne, etc.)
      if (property && ['ManyToOne', 'OneToOne'].includes(property.reference)) {
        hydrated[prop] = this.reference.createFromPK(property.entity, payload[prop]);
      }
    }

    return hydrated;
  }
}
