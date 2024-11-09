import { Container } from '@declaro/di'
import { PostService } from './domain/post/post-service'

export const container = new Container().provideClass('PostService', PostService)
