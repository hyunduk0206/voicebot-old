type TtsApiKeyType = {
	[key: number]: string | boolean;
};

export const ttsApiKey: TtsApiKeyType = {
	0: import.meta.env.VITE_TTS_API_KEY_0,
	1: import.meta.env.VITE_TTS_API_KEY_1,
	2: import.meta.env.VITE_TTS_API_KEY_2,
	3: import.meta.env.VITE_TTS_API_KEY_3,
	4: import.meta.env.VITE_TTS_API_KEY_4,
	5: import.meta.env.VITE_TTS_API_KEY_5
};
