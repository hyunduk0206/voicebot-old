const gnictPort = '20080';
const gnictHost = 'gnlabs.iptime.org';
const ketiPort = '28443';
// const ketiHost = "ketiair.com";
const ketiHost = '115.95.228.155';

const protocol = 'https';
const pathTalk = 'talk';
const pathOffer = 'offer';

export const endpoints = {
	offerMonitoring: `${protocol}://${gnictHost}:${gnictPort}/${pathOffer}`,
	offerEmpathy: `${protocol}://${ketiHost}:${ketiPort}/${pathOffer}`,
	talk: `${protocol}://${ketiHost}:${ketiPort}/${pathTalk}`,
	tts: 'https://kakaoi-newtone-openapi.kakao.com/v1/synthesize'
};
