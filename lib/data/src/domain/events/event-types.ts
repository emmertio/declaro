export enum ModelQueryEvent {
    BeforeLoad = 'beforeLoad',
    AfterLoad = 'afterLoad',
    BeforeLoadMany = 'beforeLoadMany',
    AfterLoadMany = 'afterLoadMany',
    BeforeSearch = 'beforeSearch',
    AfterSearch = 'afterSearch',
    BeforeCount = 'beforeCount',
    AfterCount = 'afterCount',
}

export enum ModelMutationAction {
    Create = 'create',
    BeforeCreate = 'beforeCreate',
    AfterCreate = 'afterCreate',
    Update = 'update',
    BeforeUpdate = 'beforeUpdate',
    AfterUpdate = 'afterUpdate',
    Remove = 'remove',
    BeforeRemove = 'beforeRemove',
    AfterRemove = 'afterRemove',
    Restore = 'restore',
    BeforeRestore = 'beforeRestore',
    AfterRestore = 'afterRestore',
}
