import "isomorphic-fetch"
import config from '../util/config'

// Once every hour.
const intervalTime = 60000 * 30;
let priceInterval;
let bucket;

const cmcKey = config('CMC');


// Saving last prices in RAM, to alleviate DB calls.
// Mimics eventually persistent behavior.
let pricesInRam = {};

export const PRICE_NETS = {
    MAIN:'prices',
    EOS_MAINNET:'prices:eos:aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906'
}

const networks = Object.keys(PRICE_NETS).map(x => PRICE_NETS[x]);

const cachePrices = async (id, prices) => {
	if(prices && Object.keys(prices).length) {
		await bucket.upsert(id, prices);
		pricesInRam[id] = prices;
	}

	return true;
}

export default class PriceService {

    static setBucket(_b){
        bucket = _b;
    }

    /***
     * Converts any paid amount to available backup service usage time.
     * @param blockchain
     * @param amount
     * @returns {Promise.<number>}
     */
    static async getBackupTimePaidFor(blockchain, amount){
        const prices = await PriceService.getPrices();

        // $ per day
        const pricePerDay = 0.50;

        let daysPaidFor = 0;

        switch(blockchain){
            case 'eos':
                const price = parseFloat(prices.EOS.price).toFixed(2);
                const paid = parseFloat(amount.split(' ')[0]).toFixed(4);
                daysPaidFor = Math.round(parseFloat((price / pricePerDay) * paid));
                break;
            default:
                break;
        }

        return daysPaidFor;
    }

    static async getPrices(){
        await Promise.all(networks.map(async net => {
	        if(!pricesInRam.hasOwnProperty(net)){
		        pricesInRam[net] = (await bucket.get(net)).value;
		        return true;
            } else {
	            return true;
            }
        }));
        return pricesInRam;
    }

    static async watch(){
        clearInterval(priceInterval);
        return new Promise(async resolve => {

            const setPrices = async () => {
                if(!bucket) return;

                for(let i = 0; i < networks.length; i++){
                    await fetchers[networks[i]]();
                }
                // await Promise.all(networks.map(net => PriceService[net]));

                resolve(true);
            };

            await setPrices();
            priceInterval = setInterval(async () => {
                await setPrices();
            }, intervalTime);
        })
    }





}


const fetchers = {
	[PRICE_NETS.MAIN]:async () => {
		const prices = await Promise.race([
			new Promise(resolve => setTimeout(() => resolve(false), 2500)),
			fetch('https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest', {
				headers: { 'X-CMC_PRO_API_KEY': cmcKey },
				json: true,
				gzip: true
			}).then(x => x.json()).then(res => {
				return res.data.map(token => {
					const {circulating_supply, max_supply, total_supply, symbol, name, quote} = token;
					let {volume_24h, price} = quote.USD;
					price = parseFloat(price).toFixed(2);
					return {
						symbol,
						name,
						price
					};
				}).reduce((acc, x) => {
					acc[x.symbol] = x;
					return acc;
				}, {});
			}).catch(err => {
				console.log(err);
				return null;
			})
		]);

		return cachePrices(PRICE_NETS.MAIN, prices);
	},

	[PRICE_NETS.EOS_MAINNET]:async () => {
		const prices = await Promise.race([
			new Promise(resolve => setTimeout(() => resolve(false), 2500)),
			fetch('https://api.newdex.io/v1/ticker/all', {
				json: true,
				gzip: true
			}).then(x => x.json()).then(res => res.data ? res.data.map(({change, contract, currency:symbol, last:price}) => ({
				contract, symbol, price, chainId:PRICE_NETS.EOS_MAINNET.replace('prices:eos:', '')
			})).filter(x => x.contract !== 'eosio.token') : null).catch(err => {
				console.log(err);
				return null;
			})
		]);

		return cachePrices(PRICE_NETS.EOS_MAINNET, prices);
	}
}

