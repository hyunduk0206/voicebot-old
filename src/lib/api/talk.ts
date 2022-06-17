import { ttsApiKey } from '$lib/api/keys';
import { endpoints } from '$lib/api/endpoints';

import { getRandomIntInclusive } from '$lib/utils/random';

type EmpathyReq = {
	audio: string | ArrayBuffer;
	text: string;
	uid: string;
};

export const fetchTtsData = async (speechText: string): Promise<ArrayBuffer> => {
	const keyNo: number = getRandomIntInclusive(0, 5);
	const headers_synth = {
		'Content-Type': 'application/xml',
		Authorization: `KakaoAK ${ttsApiKey[keyNo]}`
	};
	const synth_in = `<speak> <voice name='WOMAN_DIALOG_BRIGHT'> ${speechText} </voice> </speak>`;
	const res = await fetch(endpoints.tts, {
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

export const fetchEmpathyData = async (empathyReq: EmpathyReq) => {
	const res = await fetch(endpoints.talk, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(empathyReq)
	});

	if (!res.ok) {
		const message = await res.text();
		throw new Error(message);
	}

	return await res.json();
};
