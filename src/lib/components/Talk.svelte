<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	import { fetchTtsData, fetchEmpathyData } from '$lib/api/talk';
	import {
		currentStatus,
		say,
		heard,
		status,
		currentExpression,
		expression
	} from '$lib/stores/bot';
	import { reloadApp } from '$lib/utils/reloadApp';

	const WATCHDOG_LIMIT = 20;
	let isActive = false;
	let errorNoReason = 0;
	let watchdogTimer = 0;
	let deadlock = false;
	let chunks = [];
	let recognition = null;
	let mediaRecorder = null;
	let stream = null;
	const DELAY_RELOAD = 1000 * 60 * 30;

	const setIdle = () => {
		$currentStatus = $status.idle;
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
					errorNoReason = 0;
					deadlock = false;

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
							// [TODO] solve deadlock issue

							reloadApp(window, DELAY_RELOAD);
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
					errorNoReason++;
				};

				recognition.onend = () => {
					console.debug(`Speech recognition ended | ${$currentStatus}`);

					if (!isActive) return;

					if (mediaRecorder.state === 'recording') mediaRecorder.stop();
					if ($currentStatus === $status.listening) $currentStatus = $status.thinking;

					if (errorNoReason > 3) {
						console.error('Error occurred five times without reason');
						reloadApp(window, DELAY_RELOAD);
					}

					if (deadlock) return;

					recognition.start();
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

					const reader = new FileReader();
					reader.readAsDataURL(blob);
					reader.onloadend = async () => {
						const audio = reader.result;
						const empathyReq = {
							audio,
							text: $heard,
							uid: 'temp-uid'
						};
						try {
							const empathyRes = await fetchEmpathyData(empathyReq); // [TODO] connect to db
							const audioData: ArrayBuffer = await fetchTtsData(empathyRes.text);
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
