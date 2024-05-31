import { type IMovie } from '@/.declaro/models/IMovie'

export interface IMovieRepository {
    getMovies(): Promise<IMovie[]>
}
