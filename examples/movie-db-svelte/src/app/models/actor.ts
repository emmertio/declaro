import { RelationFormat, StringFormat, defineCollection, t } from '@declaro/core';
import movie from './movie';

export default defineCollection('actor', (context) => ({
	description: 'An actor in the database.',
	properties: {
		name: t.string(),
		description: t.string({
			format: StringFormat.TEXT_LONG
		}),
		movies: t.relation({
			format: RelationFormat.ManyToMany,
			model: movie
		})
	}
}));
