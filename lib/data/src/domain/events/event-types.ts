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
    BeforeCreate = 'beforeCreate',
    AfterCreate = 'afterCreate',
    BeforeUpdate = 'beforeUpdate',
    AfterUpdate = 'afterUpdate',
    BeforeRemove = 'beforeRemove',
    AfterRemove = 'afterRemove',
    BeforeRestore = 'beforeRestore',
    AfterRestore = 'afterRestore',
}
