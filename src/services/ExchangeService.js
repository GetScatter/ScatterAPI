import "isomorphic-fetch"
import config from '../util/config'

const COINSWITCH_KEY = config('COINSWITCH_KEY');

import couchbase from '../database/couchbase'
const bucket = couchbase('exchange');

const SERVICES = {
	COINSWITCH:'coinswitch',
	NEWDEX:'newdex',
};

const TYPES = {
	EXCHANGE:'Exchange Service',
	DEX:'Decentralized Exchange',
	ATOMIC:'Atomic Swap',
};

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
			        type:TYPES.EXCHANGE,
			        id:x.destinationCoin,
			        symbol:x.destinationCoin.toUpperCase(),
		        })))
		        .catch(err => {
		        	console.error(err);
		        	return []
		        });

	        const STABLECOINS = ['USDC', 'TUSD', 'PAX', 'DAI'] //'USDT' <-- Don't add this, their USDT is omni
	        const BASECOINS = ['TRX', 'EOS', 'ETH', 'BTC'];
	        allPairs = allPairs.filter(x => BASECOINS.includes(x.symbol) || STABLECOINS.includes(x.symbol));
	        allPairs = allPairs.map(x => {
	        	return Object.assign(x, {
	        		blockchain: BASECOINS.includes(x.symbol) ? x.symbol.toLowerCase()
				       : STABLECOINS.includes(x.symbol) ? 'eth' : null,
		        })
	        })
        }

        // if(canUseNewDex(token)){
        // 	let pairs = await this.get(`tickers`, newDexApi)
		//         .then(res => res.map(x => ({
		// 	        service:SERVICES.NEWDEX,
		// 	        type:TYPES.DEX,
		// 	        id:x.symbol,
		// 	        symbol:x.currency.toUpperCase(),
	    //          blockchain:'eos',
		//         })))
		//         .catch(err => {
		// 	        return []
		//         });
		//
        // 	if(!isEos(token)){
        // 		pairs = pairs.filter(x => x.symbol.toLowerCase() === 'eos');
	    //     } else {
		//         pairs = pairs.filter(x => x.symbol.toLowerCase() !== 'eos');
	    //     }
		//
        // 	allPairs = allPairs.concat(pairs);
        // }

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
		    	const tokenId = isEos(token) ? toSymbol : `${token.contract}-${token.symbol}-eos`.toLowerCase();
			    return this.get(`price?symbol=${tokenId}`, newDexApi)
				    .then(x => {
				    	return {
						    rate:(isEos(token) ? 1 / x.price : x.price),
						    min:null,
						    max:null,
					    }
				    })
				    .catch(err => {
				    	console.error('err', err);
					    return null
				    });

	    }



	    return null;

    }

    async createOrder(service, token, toSymbol, amount, from, to){


	    switch(service){
		    case SERVICES.COINSWITCH:

			    const accountToExchangeAccount = acc => ({
				    address:acc.account,
				    tag:acc.hasOwnProperty('memo') && acc.memo && acc.memo.length ? acc.memo : null
			    });

			    const refundAddress = accountToExchangeAccount(from);
			    const destinationAddress = accountToExchangeAccount(to);

			    const fromSymbol = token.symbol;
			    const data = {
				    depositCoin:fromSymbol.toLowerCase(),
				    destinationCoin:toSymbol.toLowerCase(),
				    depositCoinAmount:amount,
				    destinationAddress,
				    refundAddress,
			    };

			    const order = await this.post(`order`, data).then(res => {
			    	return {
					    id:res.orderId,
					    account:res.exchangeAddress.address,
					    memo:res.exchangeAddress.tag,
					    deposit:res.expectedDepositCoinAmount,
					    expected:res.expectedDestinationCoinAmount,
				    }
			    }).catch(err => {
				    console.error('EXCHANGE ERR: ', err);
				    return null;
			    });

			    delete token.id;
			    if(order) await bucket.upsert(`order:${order.id}`, {order, service, from:token, to:toSymbol, accepted:false});
			    return order;

		    case SERVICES.NEWDEX:


	    }





    }

    async getOrder(orderId){
    	const updated = await this.get(`order/${orderId}`).catch(() => null);
    	const original = await bucket.get(`order:${orderId}`).then(x => x.value).catch(() => null);
        return {updated, original};
    }

    static async cancelled(orderId){
    	await bucket.remove(`order:${orderId}`).then(x => x.value).catch(() => null);
        return true;
    }

    static async accepted(orderId){
	    const original = await bucket.get(`order:${orderId}`).then(x => x.value).catch(() => null);
	    original.accepted = true;
	    await bucket.upsert(`order:${orderId}`, original);
        return true;
    }

}
