import { makeInjectorMiddleware } from '@declaro/core'
import { Db } from '../db'
import { IDBContext } from '../db/utils/DbConfig'

export const contactsModule = makeInjectorMiddleware(async (injector) => {
    const dbContext: IDBContext = injector.resolve(Db.Context)
    return injector
    // dbContext.addModel(Contact)
})
