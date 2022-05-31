<script lang="ts">
	import { endpoints } from '$lib/stores/endpoints';
	import { webrtcStart, webrtcStop } from '$lib/webrtc';
	import { onDestroy, onMount } from 'svelte';

	const webrtcParams = {
		'use-datachannel': 'on',
		'datachannel-parameters': '{"ordered": true}',
		'audio-codec': 'opus/48000/2',
		'use-video': 'on',
		'use-audio': 'on',
		'video-resolution': '320x240',
		'video-transform': 'edges',
		'video-codec': 'H264/90000',
		'use-stun': 'on'
	};

	const webrtcParamsKeti = {
		'datachannel-parameters': '{"ordered": true}',
		'audio-codec': 'opus/48000/2',
		'use-video': 'on',
		'video-resolution': '320x240',
		'video-transform': 'edges',
		'video-codec': 'H264/90000',
		'use-stun': 'on'
	};
	let webrtcLocal, webrtcRemote;

	const userId = 'temp-id'; // [TODO] connect to db

	onMount(() => {
		const genDomElem = (name = '') => {
			return {
				startBtn: document.getElementById(`start${name}`),
				stopBtn: document.getElementById(`stop${name}`),
				mediaDiv: document.getElementById(`media${name}`),
				dataChannelLog: document.getElementById(`data-channel${name}`),
				iceConnectionLog: document.getElementById(`ice-connection-state${name}`),
				iceGatheringLog: document.getElementById(`ice-gathering-state${name}`),
				signalingLog: document.getElementById(`signaling-state${name}`),
				webrtcVideo: document.getElementById(`webrtc-video${name}`),
				webrtcAudio: document.getElementById(`webrtc-audio${name}`)
			};
		};
		const domElemLocal = genDomElem('-local');
		const domElemRemote = genDomElem('-remote');

		try {
			webrtcLocal = webrtcStart($endpoints.offerLocalEndpoint, webrtcParams, domElemLocal, userId);
			webrtcRemote = webrtcStart(
				$endpoints.offerRemoteEndpoint,
				webrtcParamsKeti,
				domElemRemote,
				userId
			);
			domElemLocal.startBtn.style.display = 'none';
			domElemLocal.stopBtn.style.display = 'inline-block';
			domElemRemote.startBtn.style.display = 'none';
			domElemRemote.stopBtn.style.display = 'inline-block';

			domElemLocal.stopBtn.onclick = () => {
				webrtcStop(webrtcLocal);
				domElemLocal.stopBtn.style.display = 'none';
			};

			domElemRemote.stopBtn.onclick = () => {
				webrtcStop(webrtcRemote);
				domElemRemote.stopBtn.style.display = 'none';
			};
		} catch (error) {
			console.error(error);
		}
	});
</script>

<div class="flex-container">
	<div class="flex-col">
		<h1>GNICT</h1>
		<button id="start-local">Start</button>
		<button id="stop-local" style="display: none">Stop</button>

		<h2>State</h2>
		<p>ICE gathering state: <span id="ice-gathering-state-local" /></p>
		<p>ICE connection state: <span id="ice-connection-state-local" /></p>
		<p>Signaling state: <span id="signaling-state-local" /></p>

		<div id="media-local" style="display: none">
			<h2>Media</h2>

			<audio id="webrtc-audio-local" autoplay />
			<video id="webrtc-video-local" autoplay playsinline>
				<track kind="captions" />
			</video>
		</div>

		<h2>Data channel</h2>
		<pre id="data-channel-local" style="height: 200px" />
	</div>
	<div class="flex-col">
		<h1>KETI</h1>
		<button id="start-remote">Start</button>
		<button id="stop-remote" style="display: none">Stop</button>

		<h2>State</h2>
		<p>ICE gathering state: <span id="ice-gathering-state-remote" /></p>
		<p>
			ICE connection state: <span id="ice-connection-state-remote" />
		</p>
		<p>Signaling state: <span id="signaling-state-remote" /></p>

		<div id="media-remote" style="display: none">
			<h2>Media</h2>

			<audio id="webrtc-audio-remote" autoplay />
			<video id="webrtc-video-remote" autoplay playsinline>
				<track kind="captions" />
			</video>
		</div>

		<h2>Data channel</h2>
		<pre id="data-channel-remote" style="height: 200px" />
	</div>
</div>

<style>
	.flex-container {
		display: flex;
	}

	pre {
		overflow: scroll;
	}
</style>
