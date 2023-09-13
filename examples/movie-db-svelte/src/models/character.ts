import { defineModel } from '@declaro/core';

export const Character = defineModel('Character', {
	type: 'object',
	properties: {
		name: {
			type: 'string'
		},
		movies: {
			$ref: 'Movie',
			format: 'many-to-many'
		},
		actor: {
			$ref: 'Person',
			format: 'many-to-many'
		}
	}
});
