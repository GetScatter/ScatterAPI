import "isomorphic-fetch"
import config from '../util/config'

let bucket;
const bucketKey = 'webhooklog';

let inRam = [];

export default class WebHookService {

	static setBucket(_b){
		bucket = _b;
		bucket.get(bucketKey).then(x => inRam = x).catch(err => {
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
				status:x.payload.status,
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
		const {id, status, externalCustomerId, updatedAt} = payload;
		inRam.push({service:'moonpay', unique:Math.round(Math.random() * 99999999999), id:externalCustomerId, payload});
		await bucket.upsert(bucketKey, inRam);
		return true;
		/*
		{
		  "id": "354b1f46-480c-4307-9896-f4c81c1e1e17",
		  "createdAt": "2018-08-27T19:40:43.748Z",
		  "updatedAt": "2018-08-27T19:40:43.804Z",
		  "baseCurrencyAmount": 50,
		  "quoteCurrencyAmount": 0.12255,
		  "feeAmount": 4.99,
		  "extraFeeAmount": 2.5,
		  "areFeesIncluded": false,
		  "status": "completed",
		  "failureReason": null,
		  "walletAddress": "0x9c76ae45c36a4da3801a5ba387bbfa3c073ecae2",
		  "walletAddressTag": null,
		  "cryptoTransactionId": "0x548b15d1673d4a8c9ab93a48bc8b42e223c5f7776cea6044b91d0f3fe79b0bd6",
		  "returnUrl": "https://buy.moonpay.io",
		  "redirectUrl": null,
		  "baseCurrencyId": "71435a8d-211c-4664-a59e-2a5361a6c5a7",
		  "currencyId": "e1c58187-7486-4291-a95e-0a8a1e8ef51d",
		  "customerId": "7138fb07-7c66-4f9a-a83a-a106e66bfde6",
		  "cardId": "68e46314-93e5-4420-ac10-485aef4e19d0",
		  "bankAccountId": null,
		  "bankDepositInformation": null,
		  "bankTransferReference": null,
		  "eurRate": 1,
		  "usdRate": 1.11336,
		  "gbpRate": 0.86044,
		  "externalTransactionId": null
		}
		 */
	}

}
