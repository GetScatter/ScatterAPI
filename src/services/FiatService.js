import "isomorphic-fetch"
import config from '../util/config'

// Once every 1/2 hour.
const intervalTime = 60000 * 30;
let interval;
let bucket;
const bucketKey = 'fiat_conversions';

const fixerKey = config('FIXER');
const url = `http://data.fixer.io/api/latest?access_key=${fixerKey}&base=USD`;


// Saving last prices in RAM, to alleviate DB calls.
// Mimics eventually persistent behavior.
let inRam;

export default class FiatService {

	static setBucket(_b){
		bucket = _b;
	}

	static async getConversions(){
		if(!inRam) inRam = (await bucket.get(bucketKey)).value;
		return inRam;
	}

	static async watch(){
		clearInterval(interval);
		return new Promise(async resolve => {

			const set = async () => {
				if(!bucket) return;

				const conversions = await FiatService.getAll();
				if(conversions) {
					await bucket.upsert(bucketKey, conversions);
					inRam = conversions;
				}

				resolve(true);
			};

			await set();
			interval = setInterval(async () => {
				await set();
			}, intervalTime);
		})
	}

	static getAll(){
		return Promise.race([
			new Promise(resolve => setTimeout(() => resolve(false), 2500)),
			fetch(url, {
				json: true,
				gzip: true
			}).then(x => x.json()).then(res => {
				return res.rates;
			}).catch(err => {
				console.error(err);
				return null;
			})
		])
	}

}
