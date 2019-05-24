import "isomorphic-fetch"

const intervalTime = 60000 * 60;
let feeInterval;
let bucket;

let inRam = {};

export default class FeeService {

    static setBucket(_b){
        bucket = _b;
    }



    static async getFees(){
        return inRam;
    }

    static async watch(){
        clearInterval(feeInterval);
        return new Promise(async resolve => {

            const setFees = async () => {
                if(!bucket) return;

                const bitcoin = await fetch(`https://bitcoinfees.earn.com/api/v1/fees/recommended`).then(x => x.json()).then(x => x.fastestFee).catch(() => null);
	            if(bitcoin) {
		            inRam['btc'] = bitcoin;
	            	await bucket.upsert(`fees:btc`, bitcoin);
	            }

                resolve(true);
            };

            await setFees();
            feeInterval = setInterval(async () => {
                await setFees();
            }, intervalTime);
        })
    }
}



