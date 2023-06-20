import { NumberFormat, defineCollection, t, StringFormat } from '@declaro/core';

export default defineCollection('movie', () => ({
	description: 'A movie in the database.',
	properties: {
		title: t.string(),
		description: t.string({
			format: StringFormat.TEXT_LONG
		}),
		budget: t.number({ format: NumberFormat.FLOAT }),
		year: t.number({ format: NumberFormat.INT })
	}
}));
