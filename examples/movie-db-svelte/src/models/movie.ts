import { defineModel } from '@declaro/core';

export const Person = defineModel('Person', {
	type: 'object',
	properties: {
		name: {
			type: 'string',
			title: 'Name'
		},
		movies: {
			$ref: 'Movie',
			format: 'one-to-many'
			// mappedBy: 'director'
		}
	}
});

/**
 * Known filters
 * - $eq
 * - $ne
 * - $gt
 * - ...etc
 * - startsWith
 * - endsWith
 * - contains
 */

export const Movie = defineModel('Movie', {
	type: 'object',
	properties: {
		title: {
			type: 'string',
			title: 'Title'
		},
		description: {
			type: 'string',
			format: 'text',
			title: 'Description'
		},
		year: {
			type: 'integer',
			format: 'int32',
			title: 'Year'
		},
		director: {
			$ref: 'Person',
			format: 'many-to-many'
		}
	},
	required: ['title', 'year']
});
