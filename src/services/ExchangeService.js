import "isomorphic-fetch"
import config from '../util/config'

const COINSWITCH_KEY = config('COINSWITCH_KEY');

import couchbase from '../database/couchbase'
const bucket = couchbase('exchange');

const SERVICES = {
	COINSWITCH:'coinswitch',
	NEWDEX:'newdex',
}

const isEos = token => token.blockchain === 'eos'
	&& token.contract === 'eosio.token'
	&& token.symbol.toLowerCase() === 'eos'
	&& token.chainId === 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906';

const isEth = token => token.blockchain === 'eth'
	&& token.contract === 'eth'
	&& token.symbol.toLowerCase() === 'eth'
	&& token.chainId === '1';

const isTrx = token => token.blockchain === 'trx'
	&& token.contract === 'trx'
	&& token.symbol.toLowerCase() === 'trx'
	&& token.chainId === '1';

const coinSwitchApi = `https://api.coinswitch.co/v2/`;
const canUseCoinSwitch = token => {
	if(isEos(token)) return true;
	if(isEth(token)) return true;
	if(isTrx(token)) return true;
	return false;
};

const newDexApi = `https://api.newdex.io/v1/`;
const canUseNewDex = (token) => {
	return token.blockchain === 'eos';
}

const baseHeaders = {
	'Accept': 'application/json',
	'Content-Type': 'application/json'
};

const coinSwitchHeader = (ip = "127.0.0.1") => ({
	"x-user-ip":ip,
	"x-api-key":COINSWITCH_KEY
});

const getHeaders = (api, ip = '127.0.0.1') => {
	let headers = {
		'Accept': 'application/json',
		'Content-Type': 'application/json'
	};

	if(api === coinSwitchApi) headers = Object.assign(headers, coinSwitchHeader(ip));
	return headers;
}

//https://api.newdex.io/v1/price?symbol=ridlridlcoin-ridl-eos

const GET = ip => (route, api = coinSwitchApi) => fetch(`${api}${route}`, {
	method:"GET",
	headers:getHeaders(api, ip)
}).then(r => r.json()).then(x => x.data);

const POST = ip => (route, data, api = coinSwitchApi) => fetch(`${api}${route}`, {
	method:"POST",
	headers:getHeaders(api, ip),
	body:JSON.stringify(data),
}).then(r => r.json()).then(x => x.data);

export default class ExchangeService {

    constructor(ip){
        this.get = GET(ip);
        this.post = POST(ip);
    }

    coins(){
        return this.get('coins');
    }

    async pairs(token, toSymbol){
        if(!toSymbol) toSymbol = '';


        const fromSymbol = token.symbol;

        let allPairs = [];

        if(canUseCoinSwitch(token)){
	        allPairs = await this.post(`pairs`, {depositCoin:fromSymbol.toLowerCase(), destinationCoin:toSymbol.toLowerCase()}, coinSwitchApi)
		        .then(res => res.filter(x => x.isActive))
		        .then(res => res.map(x => ({
			        service:SERVICES.COINSWITCH,
			        id:x.destinationCoin,
			        symbol:x.destinationCoin.toUpperCase(),
		        })))
		        .catch(err => {
		        	console.log(err);
		        	return []
		        });

	        const ACCEPTABLE = ['TRX', 'EOS', 'ETH', 'BTC', 'USDT'];
	        allPairs = allPairs.filter(x => ACCEPTABLE.includes(x.symbol));
        }

        if(canUseNewDex(token)){
        	let pairs = await this.get(`tickers`, newDexApi)
		        .then(res => res.map(x => ({
			        service:SERVICES.NEWDEX,
			        id:x.symbol,
			        symbol:x.currency.toUpperCase(),
		        })))
		        .catch(err => {
			        return []
		        });

        	if(!isEos(token)){
        		pairs = pairs.filter(x => x.symbol.toLowerCase() === 'eos');
	        } else {
		        pairs = pairs.filter(x => x.symbol.toLowerCase() !== 'eos');
	        }

        	allPairs = allPairs.concat(pairs);
        }

	    return allPairs;
    }

    async rate(token, toSymbol, service){

	    const fromSymbol = token.symbol;

	    switch(service){
		    case SERVICES.COINSWITCH:
			    return this.post(`rate`, {depositCoin:fromSymbol.toLowerCase(), destinationCoin:toSymbol.toLowerCase()}, coinSwitchApi)
				    .then(x => ({
					    rate:x.rate,
					    min:x.limitMinDestinationCoin,
					    max:x.limitMaxDestinationCoin,
				    }))
				    .catch(err => {
					    return null
				    });

		    case SERVICES.NEWDEX:
		    	const eosId = `eosio.token-eos-eusd`;
		    	const tokenId = isEos(token) ? toSymbol : `${token.contract}-${token.symbol}-eos`.toLowerCase();
		    	const eosPrice = eosId === tokenId ? 1 : await this.get(`price?symbol=${eosId}`, newDexApi).then(x => x.price).catch(() => null);
			    return this.get(`price?symbol=${tokenId}`, newDexApi)
				    .then(x => {
				    	console.log('x', x, tokenId);
				    	return {
						    rate:(isEos(token) ? 1 / x.price : x.price),
						    min:null,
						    max:null,
					    }
				    })
				    .catch(err => {
				    	console.log('err', err);
					    return null
				    });

	    }



	    return null;

    }

    async createOrder(fromSymbol, toSymbol, amount, from, to){
        const data = {
	        depositCoin:fromSymbol.toLowerCase(),
	        destinationCoin:toSymbol.toLowerCase(),
	        depositCoinAmount:amount,
	        destinationAddress:to,
	        refundAddress:from,
        };

        const order = await this.post(`order`, data).catch(err => {
	        console.error('EXCHANGE ERR: ', err);
	        return null;
        });

	    if(order) await bucket.upsert(`order:${order.orderId}`, {order, data});
	    return order;
    }

    getOrder(orderId){
        return this.get(`order/${orderId}`);
    }

}
