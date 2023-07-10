import { defineModel } from '@declaro/core';

export const Movie = defineModel('Movie', {
	type: 'object',
	properties: {
		title: {
			type: 'string'
		},
		year: {
			type: 'integer',
			format: 'int32'
		}
	},
	required: ['title']
});
