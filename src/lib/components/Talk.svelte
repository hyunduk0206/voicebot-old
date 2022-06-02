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

	let isActive = false;
	let errorNoReason = false;
	let watchdogTimer = 0;
	const WATCHDOG_LIMIT = 20;
	let deadlock = false;
	// const reloadDelay = 60 * 60 * 12;

	let chunks = [];

	let recognition = null;
	let mediaRecorder = null;
	let stream = null;

	const setIdle = () => {
		$currentStatus = $status.idle;
	};

	const fetchTtsData = async (empathyRes: EmpathyRes): Promise<ArrayBuffer> => {
		const synthesize_url = 'https://kakaoi-newtone-openapi.kakao.com/v1/synthesize';
		const headers_synth = {
			'Content-Type': 'application/xml',
			Authorization: `KakaoAK ${$ttsApiKey}`
		};
		const synth_in = `<speak> <voice name='WOMAN_DIALOG_BRIGHT'> ${empathyRes.text} </voice> </speak>`;
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

	const fetchEmpathyData = async (base64data, text, uid) => {
		const empahtyReq: EmpathyReq = {
			audio: base64data,
			text,
			uid
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

		isActive = true;

		const audioCtx = new AudioContext();
		let audioSource;
		const playAudioData = (audioData) => {
			try {
				audioCtx.decodeAudioData(audioData, (buffer) => {
					audioSource = audioCtx.createBufferSource();
					audioSource.addEventListener('ended', setIdle);
					audioSource.buffer = buffer;
					audioSource.connect(audioCtx.destination);
					audioSource.start(0);
				});
			} catch (error) {
				throw error;
			}
		};

		const gnSpeechRecognition = (mediaRecorder) => {
			if ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) {
				// @ts-ignore
				recognition = new webkitSpeechRecognition() || new SpeechRecognition();

				recognition.lang = 'ko-KR';
				recognition.interimResults = true;

				recognition.onstart = () => {
					console.debug(`Speech recognition started | ${$currentStatus}`);

					if ($currentStatus === $status.idle) {
						watchdogTimer = 0;
						if (audioSource && audioSource.removeEventListenr) {
							audioSource.removeEventListenr('ended', setIdle);
						}
						mediaRecorder.start();
						console.debug(`Media recorder started | ${$currentStatus}`);
					} else {
						if (
							($currentStatus === $status.thinking || $currentStatus === $status.talking) &&
							watchdogTimer < WATCHDOG_LIMIT
						) {
							console.debug(`watchdogTimer: ${watchdogTimer} times`);
							watchdogTimer++;
						} else if (watchdogTimer >= WATCHDOG_LIMIT) {
							console.error('Deadlock');

							// [TODO] solve deadlock issue
							deadlock = true;
							recognition.stop();
							$currentStatus = $status.idle;
							$say = '안녕하세요';
							talk();

							// setTimeout(() => {
							// 	window.location.reload();
							// }, reloadDelay);
						}

						setTimeout(() => {
							recognition.stop();
						}, 200);
					}
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

				recognition.onerror = () => {
					console.error('Speech Recognition Error');
					errorNoReason = true;
				};

				recognition.onend = () => {
					console.debug(`Speech recognition ended | ${$currentStatus}`);

					if (!isActive) return;

					if (mediaRecorder.state === 'recording') mediaRecorder.stop();
					if ($currentStatus === $status.listening) $currentStatus = $status.thinking;

					if (errorNoReason) {
						console.error('Error occurred without reason');
						// $currentStatus = $status.idle;
						errorNoReason = false;
					}

					if (!deadlock) recognition.start();
				};

				recognition.start();
			} else {
				console.error('Speech Recognition Not Available');
			}
		};

		const startMediaRecorder = async (stream) => {
			mediaRecorder = new MediaRecorder(stream);

			mediaRecorder.ondataavailable = (e) => {
				chunks.push(e.data);
			};

			mediaRecorder.onstop = (e) => {
				console.debug(`Media recorder ended | ${$currentStatus}`);

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

					const reader = new FileReader();
					reader.readAsDataURL(blob);
					reader.onloadend = async () => {
						const base64data = reader.result;
						try {
							const empathyRes = await fetchEmpathyData(base64data, $heard, 'temp-uid'); // [TODO] connect to db
							const audioData: ArrayBuffer = await fetchTtsData(empathyRes);
							playAudioData(audioData);
							$currentExpression = $expression[`${empathyRes.emotion}`];
							$say = empathyRes.text;
						} catch (error) {
							console.error(error);
						}
						$currentStatus = $status.talking;
					};
				}
				chunks = [];
			};

			mediaRecorder.onerror = (e: MediaRecorderErrorEvent) => {
				const error = e.error;
				console.error(error);

				mediaRecorder.resume();
				console.debug('MediaRecorder resumed');
			};
		};

		const talk = async () => {
			deadlock = false;
			try {
				const constraints = {
					audio: true
				};
				stream = await navigator.mediaDevices.getUserMedia(constraints);
			} catch (err) {
				console.error(err);
			}

			console.debug('VAD:', stream);
			startMediaRecorder(stream);
			gnSpeechRecognition(mediaRecorder);
		};

		$currentStatus = $status.idle;
		$say = '안녕하세요';
		talk();
	});

	onDestroy(() => {
		console.debug('talk.svelte destroyed');
		isActive = false;

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
