<script lang="ts">
	import { onMount } from 'svelte';
	import '../styles/global.css';

	let isPageLoaded = false;
	onMount(() => {
		isPageLoaded = true;
	});
</script>

<svelte:head>
	<title>토닥이</title>
</svelte:head>

{#if !isPageLoaded}
	<div class="loader">Loading...</div>
{/if}

<main>
	<slot />
</main>

<style>
	.loader {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		left: 0;
		display: grid;
		place-items: center;
		background-color: white;
		z-index: 9999;
	}
</style>
