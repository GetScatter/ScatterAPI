import "isomorphic-fetch"
import config from '../util/config'

let bucket;
const bucketKey = 'webhooklog';

let inRam = [];

export default class WebHookService {

	static setBucket(_b){
		bucket = _b;
		bucket.get(bucketKey).then(x => inRam = x.value || []).catch(err => {
			if(err.code === 13) bucket.upsert(bucketKey, inRam);
			console.log('ERRRRR', err);
		});
	}

	static setHook(service, payload){
		if(service === 'moonpay') return this.moonpay(payload);
	}

	static findHooks(service, id){
		return inRam.filter(x => x.service === service && x.id === id).map(x => {
			return {
				service:x.service,
				id:x.id,
				status:x.data.status,
				unique:x.unique,
			}
		});
	}

	static async removeHook(unique){
		inRam = inRam.filter(x => x.unique !== unique);
		await bucket.upsert(bucketKey, inRam);
		return true;
	}


	static async moonpay(payload){
		const {externalCustomerId, data} = payload;
		inRam = inRam.filter(x => x.unique !== data.id);
		inRam.push({service:'moonpay', unique:data.id, id:externalCustomerId, data});
		await bucket.upsert(bucketKey, inRam);
		setTimeout(() => WebHookService.removeHook(data.id), 60000*15);
		return true;
	}

}
