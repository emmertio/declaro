import { MovieDTO } from '$models/MovieDTO';

export async function load() {
	const movie = new MovieDTO();
	movie.title = 'The Matrix';
	movie.year = 1999;
	movie.description =
		'A computer hacker learns from mysterious rebels about the true nature of his reality and his role in the war against its controllers.';

	return {
		movie: {
			...movie
		}
	};
}
