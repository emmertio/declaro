import { Router } from 'express'
import { MovieList } from '../domain/aggregates/movie-list'

export function createMovieRouter(movieList: MovieList) {
    const router = Router()

    router.get('/', async (req, res) => {
        const movies = await movieList.getMovies()

        res.status(200).json(movies)
    })

    return router
}
