import "isomorphic-fetch"
import config from '../util/config'

// Once every 30 minutes.
const intervalTime = 60000 * 30;
let priceInterval;
let bucket;

const cmcKey = config('CMC');

// Saving last prices in RAM, to alleviate DB calls.
// Mimics eventually persistent behavior.
let pricesInRam;

export default class PriceService {

    static setBucket(_b){
        bucket = _b;
    }

    static async getPrices(){
        if(!pricesInRam) pricesInRam = (await bucket.get('prices')).value;
        return pricesInRam;
    }

    static async watchPrices(){
        clearInterval(priceInterval);
        return new Promise(async resolve => {

            const setPrices = async () => {
                if(!bucket) return;

                const prices = await PriceService.getAll();

                if(prices && Object.keys(prices).length) {
                    await bucket.upsert('prices', prices);
                    pricesInRam = prices;
                }

                resolve(true);
            };

            await setPrices();
            priceInterval = setInterval(async () => {
                await setPrices();
            }, intervalTime);
        })
    }

    static getAll(){
        return Promise.race([
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
                        circulating_supply,
                        max_supply,
                        total_supply,
                        volume_24h,
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
        ])
    }

}