<script lang="ts">
	import type { PageData } from './$types';

	export let data: PageData;
</script>

<h1>Welcome to SvelteKit</h1>
<p>Visit <a href="https://kit.svelte.dev">kit.svelte.dev</a> to read the documentation</p>
<div>
	<div>Title: {data.movie.title}</div>
	<div>Year: {data.movie.year}</div>
	<div>Description: {data.movie.description}</div>
</div>
