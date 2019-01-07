import "isomorphic-fetch"
import config from '../util/config'

const COINSWITCH_KEY = config('COINSWITCH_KEY');

import couchbase from '../database/couchbase'
import PriceService from "./PriceService";
const bucket = couchbase('exchange');

const SERVICES = {
	COINSWITCH:'coinswitch',
	NEWDEX:'newdex',
	BANCOR_EOS:'bancor_eos'
};

const TYPES = {
	EXCHANGE:'Exchange Service',
	DEX:'Decentralized Exchange',
	ATOMIC:'Atomic Swap',
};

const eosMainnetId = 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906';
const ethToken = (symbol, contract) => ({ blockchain:'eth', chainId:'1', contract, symbol, name:symbol, decimals:18, });
const trxToken = (symbol, contract) => ({ blockchain:'trx', chainId:'1', contract, symbol, name:symbol, decimals:6, });
const eosToken = (symbol, contract, chainId = eosMainnetId) => ({ blockchain:'eos', chainId, contract, symbol, name:symbol, decimals:4, });

export const STABLETOKENS = [
	ethToken('USDC', '0xb9e31a22e3a1c743c6720f3b723923e91f3c0f8b'),
	ethToken('TUSD', '0x8dd5fbce2f6a956c3022ba3663759011dd51e73e'),
	ethToken('DAI', '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359'),
];

export const BASETOKENS = [
	{ blockchain:'btc', chainId:'1', contact:'btc', symbol:'BTC', name:'BTC', decimals:8, },
	trxToken('TRX', 'trx'),
	eosToken('EOS', 'eosio.token'),
	ethToken('ETH', 'eth')
];

const STABLECOINS = ['USDC', 'TUSD', 'DAI'] //'USDT' <-- Don't add this, their USDT is omni

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
	return BASETOKENS.concat(STABLETOKENS).find(x => x.symbol === token.symbol && x.blockchain === token.blockchain && x.chainId === token.chainId);
};

const newDexApi = `https://api.newdex.io/v1/`;
const canUseNewDex = (token) => {
	return token.blockchain === 'eos';
}

const bancorEosApi = `https://api.bancor.network/0.1/`;
const canUseBancorEos = (token) => {
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

    async pairable(){

	    const unique = t => `${t.blockchain}:${t.contract}:${t.symbol}:${t.chainId}`.toLowerCase();

	    const bancorEosPairs = await this.get(`volume`, bancorEosApi)
		    .then(async res => res.rows.map(x => (eosToken(x.from_token_code, x.from_token_account))))
		    .catch(err => []);

	    return BASETOKENS
		    .concat(STABLETOKENS)
		    .concat(bancorEosPairs)
		    .map(unique)


    }

    async pairs(token, toSymbol){
        if(!toSymbol) toSymbol = '';


        const fromSymbol = token.symbol;

        const pairs = {};

        if(canUseCoinSwitch(token)){
	        const coinswitchPairs = await this.post(`pairs`, {depositCoin:fromSymbol.toLowerCase(), destinationCoin:toSymbol.toLowerCase()}, coinSwitchApi)
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

	        pairs['base'] = coinswitchPairs.map(pair => {
		        return Object.assign({token:BASETOKENS.find(x => x.symbol === pair.symbol)}, pair);
	        }).filter(x => !!x.token);

	        pairs['stable'] = coinswitchPairs.map(pair => {
		        return Object.assign({token:STABLETOKENS.find(x => x.symbol === pair.symbol)}, pair);
	        }).filter(x => x.token);
        }

	    if(canUseBancorEos(token)){
		    const tokens = await this.get(`volume`, bancorEosApi)
			    .then(res => {
			    	return res.rows.map(x => ({
					    service:SERVICES.BANCOR_EOS,
					    type:TYPES.ATOMIC,
					    id:`${x.from_token_account}::${x.from_token_code}`,
					    symbol:x.from_token_code.toUpperCase(),
					    token:eosToken(x.from_token_code.toUpperCase(), x.from_token_account)
				    }))
			    })
			    .catch(err => {
				    console.error(err);
				    return []
			    });

		    if(tokens.find(x => x.token.symbol === token.symbol && x.token.contract === token.contract)){
			    pairs['eos'] = tokens.filter(x => x.token.symbol !== token.symbol && x.token.contract !== token.contract);
		    }
	    }

	    return pairs;
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

		    case SERVICES.BANCOR_EOS:
			    return this.get(`volume`, bancorEosApi)
				    .then(async res => {
				    	const pair = res.rows.find(x => x.from_token_code === toSymbol);
					    const fromPair = res.rows.find(x => x.from_token_code === fromSymbol);
				    	const eosPrice = res.rows.find(x => x.from_token_code === 'EOS').token_value;

				    	const rate = (() => {
				    		if(isEos(token)) return eosPrice / pair.token_value;
				    		if(toSymbol === 'EOS') return fromPair.token_value / eosPrice;
				    		return (fromPair.token_value / eosPrice) / (pair.token_value / eosPrice);
					    })();

				    	return {
						    rate,
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

	    const fromSymbol = token.symbol;

    	if(service === SERVICES.COINSWITCH){
		    const accountToExchangeAccount = acc => ({
			    address:acc.account,
			    tag:acc.hasOwnProperty('memo') && acc.memo && acc.memo.length ? acc.memo : null
		    });

		    const refundAddress = accountToExchangeAccount(from);
		    const destinationAddress = accountToExchangeAccount(to);

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
				    timestamp:+new Date(),
				    service,
			    }
		    }).catch(err => {
			    console.error('EXCHANGE ERR: ', err);
			    return null;
		    });

		    delete token.id;
		    if(order) await bucket.upsert(`order:${order.id}`, {order, service, from:token, to:toSymbol, accepted:false});
		    return order;
	    }

	    if(service === SERVICES.BANCOR_EOS){
		    const toAccount = to.account;
		    const fromAccount = from.account;

		    const pairs = await this.get(`volume`, bancorEosApi)
			    .then(async res => res.rows)
			    .catch(err => null);

		    if(!pairs) return;

		    const pairFrom = pairs.find(x => x.from_token_code === fromSymbol.toUpperCase());
		    const pairTo = pairs.find(x => x.from_token_code === toSymbol.toUpperCase());
		    if(!pairFrom || !pairTo) return;

		    const eosPrice = pairs.find(x => x.from_token_code === 'EOS').token_value;

		    const rate = (() => {
			    if(isEos(token)) return eosPrice / pairTo.token_value;
			    if(toSymbol === 'EOS') return pairFrom.token_value / eosPrice;
			    return (pairFrom.token_value / eosPrice) / (pairTo.token_value / eosPrice);
		    })();

		    const converter1 = pairFrom.converter_account;
		    const converter2 = pairTo.converter_account;

		    const id = `${fromAccount}:${toSymbol}:${toAccount}:${amount}:${+new Date()}`;

		    const decimals = toSymbol.toUpperCase() === 'IQ' ? 3 : 4;
		    const amountWithSlippage = amount*rate - ((amount*rate)*0.02);
		    const memo = `1,${converter1} BNT ${converter2} ${toSymbol.toUpperCase()},${parseFloat(amountWithSlippage).toFixed(decimals)},${toAccount}`;

		    const order = {
			    id,
			    account:'thisisbancor',
			    memo,
			    deposit:amount,
			    expected:amountWithSlippage,
			    timestamp:+new Date(),
			    service,
		    }

		    delete token.id;
		    if(order) await bucket.upsert(`order:${order.id}`, {order, service, from:token, to:toSymbol, accepted:false});
		    return order;

	    }
    }

    async getOrder(orderId){
	    const original = await bucket.get(`order:${orderId}`).then(x => x.value).catch(() => null);
	    if(!original) return;

	    if(original.order.service === SERVICES.BANCOR_EOS){
	        return {original, updated:{
				status:'complete',
	        }}
	    }

	    if(origin.order.service === SERVICES.COINSWITCH){
		    const updated = await this.get(`order/${orderId}`).catch(() => null);
		    return {updated, original};
	    }


    }

    static async cancelled(orderId){
    	await bucket.remove(`order:${orderId}`).then(x => x.value).catch(() => null);
        return true;
    }

    static async accepted(orderId){
	    const original = await bucket.get(`order:${orderId}`).then(x => x.value).catch(() => null);
	    original.accepted = true;
	    await bucket.upsert(`order:${orderId}`, original).catch(() => null);
        return true;
    }

}
