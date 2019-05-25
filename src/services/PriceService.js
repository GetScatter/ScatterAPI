import "isomorphic-fetch"
import config from '../util/config'
import FiatService from "./FiatService";
import {dateId, daysOld, hourNow} from "../util/dates";
import {STABLETOKENS} from "./ExchangeService";

const intervalTime = 60000 * 15;
let priceInterval;
let bucket;

const cmcKey = config('CMC');
const COMPARE_KEY = config('COMPARE_KEY');


// Saving last prices in RAM, to alleviate DB calls.
// Mimics eventually persistent behavior.
let pricesInRam = {};

export const PRICE_NETS = {
    MAIN:'prices',
    EOS_MAINNET:'prices:eos:aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
    ETH_MAINNET:'prices:eth:1'
}

const networks = Object.keys(PRICE_NETS).map(x => PRICE_NETS[x]);

export const CURRENCIES = ['USD', 'EUR', 'CNY', 'GBP', 'JPY', 'CAD', 'CHF', 'AUD'];

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

    static async getV2Prices(v2, convert = true){
	    const prices = await PriceService.getPrices();
	    const {EOS, ETH, TRX, BTC} = prices[PRICE_NETS.MAIN];
	    const eosMainnetPrices = prices[PRICE_NETS.EOS_MAINNET];
	    const ethMainnetPrices = prices[PRICE_NETS.ETH_MAINNET];

	    let result;


	    let conversions = await FiatService.getConversions();
	    conversions = CURRENCIES.reduce((acc,tick) => {
		    acc[tick] = conversions[tick];
		    return acc;
	    }, {});

	    const convertToMultiCurrency = x => {
	    	if(!convert) return x;
		    return Object.keys(conversions).reduce((acc,fiatTicker) => {
			    acc[fiatTicker] = parseFloat(x.price * conversions[fiatTicker]).toFixed(8);
			    return acc;
		    }, {});
	    };


	    if(v2){
		    result = {
			    // BACKWARDS COMPAT! DONT REMOVE!
			    'eos:eosio.token:eos':convertToMultiCurrency(EOS),
			    'eth:eth:eth':convertToMultiCurrency(ETH),
			    'trx:trx:trx':convertToMultiCurrency(TRX),


			    'eos:eosio.token:eos:aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906':convertToMultiCurrency(EOS),
			    'eth:eth:eth:1':convertToMultiCurrency(ETH),
			    'btc:btc:btc:1':convertToMultiCurrency(BTC),
			    'trx:trx:trx:1':convertToMultiCurrency(TRX),
		    };

	    } else {
		    result = { EOS, ETH, TRX };
	    }

	    eosMainnetPrices.map(x => {
		    const clone = JSON.parse(JSON.stringify(x))
		    clone.price = parseFloat(parseFloat(EOS.price * x.price).toFixed(8));
		    result[`eos:${x.contract}:${x.symbol}:${x.chainId}`.toLowerCase()] = convertToMultiCurrency(clone);
	    })

	    ethMainnetPrices.map(x => {
		    const clone = JSON.parse(JSON.stringify(x))
		    result[`eth:${x.contract}:${x.symbol}:1`.toLowerCase()] = convertToMultiCurrency(clone);
	    })

	    return result;
    }

    static async watch(){
        clearInterval(priceInterval);
        return new Promise(async resolve => {

            const setPrices = async () => {
                if(!bucket) return;

                for(let i = 0; i < networks.length; i++){
                    await fetchers[networks[i]]();
                }

                await PriceService.cacheTimeline();

                resolve(true);
            };

            await setPrices();
            priceInterval = setInterval(async () => {
                await setPrices();
            }, intervalTime);
        })
    }

    static async getPriceTimeline(id){
    	return bucket.get(`prices:timeline:${id}`).then(x => {
    		return x.value
	    }).catch(err => {
	    	console.error(err);
	    	return {};
	    })
    }

    static async cacheTimeline(){
	    const id = dateId();
	    const hour = hourNow();

	    let pricesRaw = await this.getV2Prices(true, false);
	    pricesRaw = Object.keys(pricesRaw).reduce((acc,x) => {
	    	acc[x] = pricesRaw[x].price;
	    	return acc;
	    }, {});
	    let prices = await this.getPriceTimeline(id);
	    if(!prices || !pricesRaw) return;

	    prices.latest = hour;
	    prices[hour] = pricesRaw;

	    return bucket.upsert(`prices:timeline:${id}`, prices);
    }
}


const fetchers = {
	[PRICE_NETS.MAIN]:async () => {
		const SYMBOLS = 'BTC,TRX,ETH,EOS,BTC'
		const prices = await Promise.race([
			new Promise(resolve => setTimeout(() => resolve(false), 2500)),
			fetch(`https://min-api.cryptocompare.com/data/pricemulti?fsyms=${SYMBOLS}&tsyms=USD&api_key=${COMPARE_KEY}`)
			.then(x => x.json())
			.then(res => {
				return Object.keys(res).map(symbol => {
					return {
						symbol,
						name:symbol,
						price:res[symbol].USD
					};
				}).reduce((acc, x) => {
					acc[x.symbol] = x;
					return acc;
				}, {});
			}).catch(err => {
				console.error(err);
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
			}).then(x => x.json()).then(res => {
				if(!res.data) return null;

				let data = res.data.filter(x => x.symbol.indexOf('-eusd') === -1);
				data = res.data.filter(x => x.symbol.indexOf('-cusd') === -1 || x.symbol === 'stablecarbon-cusd-eos');
				data = res.data.filter(x => x.symbol.indexOf('-tlos') === -1);
				data = data.map(({change, contract, currency:symbol, last:price}) => ({
					contract, symbol, price, chainId:PRICE_NETS.EOS_MAINNET.replace('prices:eos:', '')
				}))
				data = data.filter(x => x.contract !== 'eosio.token');
				return data;
			}).catch(err => {
				console.error(err);
				return null;
			})
		]);

		return cachePrices(PRICE_NETS.EOS_MAINNET, prices);
	},

	[PRICE_NETS.ETH_MAINNET]:async () => {
		const prices = await Promise.race([
			new Promise(resolve => setTimeout(() => resolve(false), 2500)),
			fetch('https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest', {
				headers: { 'X-CMC_PRO_API_KEY': cmcKey },
				json: true,
				gzip: true
			}).then(x => x.json()).then(res => {
				return res.data.filter(x => STABLETOKENS.find(t => t.symbol === x.symbol.toUpperCase())).map(token => {
					const {circulating_supply, max_supply, total_supply, symbol, name, quote} = token;
					let {volume_24h, price} = quote.USD;
					return {
						symbol,
						name:symbol,
						contract:STABLETOKENS.find(t => t.symbol === symbol.toUpperCase()).contract,
						price
					};
				});
			}).catch(err => {
				console.log(err);
				return null;
			})
		]);

		return cachePrices(PRICE_NETS.ETH_MAINNET, prices);
	}
}

