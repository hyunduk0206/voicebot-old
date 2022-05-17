<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		currentStatus,
		say,
		heard,
		status,
		currentExpression,
		expression
	} from '$lib/stores/bot';
	import { endpoints } from '$lib/stores/endpoints';
	import { debugMode } from '$lib/stores/config';
	import { ttsApiKey } from '$lib/stores/api-keys';

	let active = false;

	let chunks = [];

	let recognition = null;
	let mediaRecorder = null;
	let stream = null;

	const fetchTtsData = async (empathyRes: EmpathyRes) => {
		const synthesize_url = 'https://kakaoi-newtone-openapi.kakao.com/v1/synthesize';
		const headers_synth = {
			'Content-Type': 'application/xml',
			Authorization: `KakaoAK ${$ttsApiKey}`
		};
		const synth_in = `<speak> <voice name='WOMAN_READ_CALM'> ${empathyRes.text} </voice> </speak>`;

		const res = await fetch(synthesize_url, {
			method: 'POST',
			headers: headers_synth,
			body: JSON.stringify({
				data: synth_in
			})
		});

		if (!res.ok) {
			const message = await res.text();
			throw new Error(message);
		}

		return await res.arrayBuffer();
	};

	const fetchEmpathyData = async (base64data) => {
		const empahtyReq: EmpathyReq = {
			audio: base64data,
			text: $heard,
			uid: 'temp-uid' // [TODO] connect to db
		};
		const res = await fetch($endpoints.talkEndpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(empahtyReq)
		});

		if (!res.ok) {
			const message = await res.text();
			throw new Error(message);
		}

		return await res.json();
	};

	onMount(() => {
		console.debug('talk.svelte mounted');

		active = true;

		const audioCtx = new AudioContext();
		let audioSource;
		const setIdle = () => {
			$currentStatus = $status.idle;
			if ($currentStatus === $status.idle) {
				recognition.start();
			}
		};

		const reader = new FileReader();
		const gnSpeechRecognition = (mediaRecorder) => {
			if ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) {
				// @ts-ignore
				recognition = new webkitSpeechRecognition() || new SpeechRecognition();

				recognition.lang = 'ko-KR';
				recognition.interimResults = true;

				recognition.onstart = () => {
					console.debug('Speech recognition started');

					if (audioSource && audioSource.removeEventListenr) {
						audioSource.removeEventListenr('ended', setIdle);
					}
					mediaRecorder.start();
					console.debug('Media recorder started');
				};

				recognition.onresult = (e) => {
					if ($currentStatus === $status.idle || $currentStatus === $status.listening) {
						$currentStatus = $status.listening;
						const text = Array.from(e.results)
							.map((result) => result[0])
							.map((result) => result.transcript)
							.join('');

						if (e.results[0].isFinal) {
							if (text.includes('확인')) {
								console.log('확인?');
							}
							$say = text;
						}

						$heard = text;
					}
				};

				// recognition.onerror = () => {
				//   console.error("Speech Recognition Error");
				// };

				recognition.onend = () => {
					console.debug('Speech recognition ended');

					if (active) {
						if (mediaRecorder.state === 'recording') {
							mediaRecorder.stop();
						}

						if ($currentStatus === $status.listening) {
							$currentStatus = $status.thinking;
						}

						if ($currentStatus === $status.idle) {
							recognition.start();
						}
					}
				};

				recognition.start();
			} else {
				console.error('Speech Recognition Not Available');
			}
		};

		const talk = async () => {
			const constraints = {
				audio: true
			};

			try {
				stream = await navigator.mediaDevices.getUserMedia(constraints);
				console.debug('VAD:', stream);
				mediaRecorder = new MediaRecorder(stream);

				gnSpeechRecognition(mediaRecorder);

				mediaRecorder.ondataavailable = (e) => {
					chunks.push(e.data);
				};

				mediaRecorder.onstop = (e) => {
					console.debug('Media recorder ended');

					if ($currentStatus === $status.thinking) {
						const soundClips = document.querySelector('.sound-clips');
						const blob = new Blob(chunks, {
							type: 'audio/webm; codecs=opus'
						});
						if ($debugMode) {
							const clipContainer = document.createElement('article');
							const audio = document.createElement('audio');

							clipContainer.classList.add('clip');
							audio.setAttribute('controls', '');

							clipContainer.appendChild(audio);
							soundClips.appendChild(clipContainer);

							const audioURL = window.URL.createObjectURL(blob);
							audio.src = audioURL;
						}
						reader.readAsDataURL(blob);
					}
					chunks = [];
				};

				reader.onloadend = async () => {
					const base64data = reader.result;
					const empathyRes = await fetchEmpathyData(base64data);
					const audioData = await fetchTtsData(empathyRes);

					audioCtx.decodeAudioData(audioData, (buffer) => {
						audioSource = audioCtx.createBufferSource();
						audioSource.addEventListener('ended', setIdle);
						audioSource.buffer = buffer;
						audioSource.connect(audioCtx.destination);
						audioSource.start(0);
					});
					$currentExpression = $expression[`${empathyRes.emotion}`];

					$currentStatus = $status.talking;
					$say = empathyRes.text;
				};
			} catch (err) {
				console.error(err);
			}
		};

		$currentStatus = $status.idle;
		$say = '안녕하세요';
		talk();
	});

	onDestroy(() => {
		console.debug('talk.svelte destroyed');
		active = false;

		$currentStatus === $status.idle;
		console.debug('status reset to idle');

		if (mediaRecorder !== null) mediaRecorder.stop();
		if (recognition !== null) recognition.stop();

		if (stream !== null) {
			stream
				.getTracks() // get all tracks from the MediaStream
				.forEach((track) => track.stop()); // stop each of them
			console.debug('stream stopped');
		}
	});
</script>

{#if $debugMode}
	<div>
		<h1>VAD debug</h1>
		<section class="sound-clips" />
	</div>
{/if}
