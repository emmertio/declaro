import { Entity, PrimaryKey, Property } from '@mikro-orm/core'
import { v4 } from 'uuid'

@Entity({ abstract: true })
export class BaseModel {
    @PrimaryKey()
    uuid: string = v4()

    @Property()
    createdAt: Date = new Date()

    @Property({ onUpdate: () => new Date() })
    updatedAt: Date = new Date()
}
