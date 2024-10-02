import { IMovie } from '~/.declaro/models/IMovie'
import { IMovieRepository } from '../domain/interfaces/movie-repository-interface'

export class SampleMovieRepository implements IMovieRepository {
    async getMovies(): Promise<IMovie[]> {
        return [
            {
                title: 'The Shawshank Redemption',
                description:
                    'Two imprisoned men bond over several years, finding solace and eventual redemption through acts of common decency.',
                year: 1994,
                director: {
                    name: 'Frank Darabont',
                    movies: [],
                },
            },
            {
                title: 'The Godfather',
                description:
                    'The aging patriarch of an organized crime dynasty transfers control of his clandestine empire to his reluctant son.',
                year: 1972,
                director: {
                    name: 'Francis Ford Coppola',
                    movies: [],
                },
            },
            {
                title: 'The Dark Knight',
                description:
                    'When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.',
                year: 2008,
                director: {
                    name: 'Christopher Nolan',
                    movies: [],
                },
            },
            {
                title: 'The Lord of the Rings: The Fellowship of the Ring',
                description:
                    'A meek Hobbit from the Shire and eight companions set out on a journey to destroy the powerful One Ring and save Middle-earth from the Dark Lord Sauron.',
                year: 2001,
                director: {
                    name: 'Peter Jackson',
                    movies: [],
                },
            },
            {
                title: 'The Lord of the Rings: The Two Towers',
                description:
                    "While Frodo and Sam edge closer to Mordor with the help of the shifty Gollum, the divided fellowship makes a stand against Sauron's new ally, Saruman, and his hordes of Isengard.",
                year: 2002,
                director: {
                    name: 'Peter Jackson',
                    movies: [],
                },
            },
            {
                title: 'The Lord of the Rings: The Return of the King',
                description:
                    "Gandalf and Aragorn lead the World of Men against Sauron's army to draw his gaze from Frodo and Sam as they approach Mount Doom with the One Ring.",
                year: 2003,
                director: {
                    name: 'Peter Jackson',
                    movies: [],
                },
            },
        ]
    }
}
