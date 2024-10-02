import { IMovieRepository } from '../interfaces/movie-repository-interface'

export class MovieList {
    constructor(protected readonly movieService: IMovieRepository) {}

    async getMovies() {
        return this.movieService.getMovies()
    }
}
