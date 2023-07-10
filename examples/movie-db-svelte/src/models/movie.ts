import { defineModel } from '@declaro/core';

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
		}
	},
	required: ['title', 'year']
});
