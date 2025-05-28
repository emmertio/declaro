export enum EntityEventType {
    PreCreate = 'preCreate',
    Create = 'create',
    PostCreate = 'postCreate',
    PreUpdate = 'preUpdate',
    Update = 'update',
    PostUpdate = 'postUpdate',
    PreSave = 'preSave',
    Save = 'save',
    PostSave = 'postSave',
    PreDelete = 'preDelete',
    Delete = 'delete',
    PostDelete = 'postDelete',
    PreLoad = 'preLoad',
    Load = 'load',
    PostLoad = 'postLoad',
    PreSearch = 'preSearch',
    Search = 'search',
    PostSearch = 'postSearch',
}

/**
 * An array of all entity event types.
 */
export const AnyEntityEvent = Object.values(EntityEventType) as EntityEventType[]
