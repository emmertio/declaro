import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { ClassModelGenerator, ReferenceGenerator, declaro } from '@declaro/build';

export default defineConfig({
	plugins: [
		declaro({
			models: {
				generators: [new ClassModelGenerator(), new ReferenceGenerator()]
			}
		}),
		sveltekit()
	],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
