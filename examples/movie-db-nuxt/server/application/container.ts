import { Container } from '@declaro/di'
import { SampleMovieRepository } from '../infrastructure/sample-movie-repository'
import { MovieList } from '../domain/aggregates/movie-list'
import { createMovieRouter } from './routes'

export const container = new Container()
    .provideClass('IMovieRepository', SampleMovieRepository)
    .provideClass('MovieList', MovieList, ['IMovieRepository'])
    .provideFactory('MovieRouter', createMovieRouter, ['MovieList'])
