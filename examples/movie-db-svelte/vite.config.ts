import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { ClassModelGenerator, declaro } from '@declaro/build';

export default defineConfig({
	plugins: [
		declaro({
			models: {
				generators: [new ClassModelGenerator()]
			}
		}),
		sveltekit()
	],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
