import type { DeclaroRequestScope, DeclaroScope } from '@declaro/core'
import type { ITransactionScope } from './transaction-context'

export interface DataScope extends DeclaroScope, ITransactionScope {}

export interface DataRequestScope extends DeclaroRequestScope, DataScope {}
