<script lang="ts">
	import VoiceBot from '$lib/components/VoiceBot.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { currentStatus, status } from '$lib/stores/bot';
	import { debugMode } from '$lib/stores/config';

	const reloadDelay = 1000 * 60 * 60;

	onMount(() => {
		$debugMode = false;
		console.log('all.svelte mounted');
		$currentStatus = $status.idle;

		setTimeout(() => {
			window.location.reload();
		}, reloadDelay);
	});
	onDestroy(() => {
		console.log('all.svelte destroyed');
	});
</script>

<VoiceBot />
