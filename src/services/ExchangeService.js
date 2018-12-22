import "isomorphic-fetch"
import config from '../util/config'

const KEY = config('COINSWITCH_KEY');

import couchbase from '../database/couchbase'
const bucket = couchbase('exchange');

const baseUrl = `https://api.coinswitch.co/v2/`;
const baseHeaders = (ip = "127.0.0.1") => ({
	'Accept': 'application/json',
	'Content-Type': 'application/json',
	"x-user-ip":ip,
	"x-api-key":KEY
});
const GET = ip => (route) => fetch(`${baseUrl}${route}`, {
	method:"GET",
	headers:baseHeaders(ip)
}).then(r => r.json()).then(x => x.data);
const POST = ip => (route, data) => fetch(`${baseUrl}${route}`, {
	method:"POST",
	headers:baseHeaders(ip),
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

    pairs(fromSymbol, toSymbol){
        if(!toSymbol) toSymbol = '';
        return this.post(`pairs`, {depositCoin:fromSymbol.toLowerCase(), destinationCoin:toSymbol.toLowerCase()}).catch(() => null);
    }

    rate(fromSymbol, toSymbol){
        return this.post(`rate`, {depositCoin:fromSymbol.toLowerCase(), destinationCoin:toSymbol.toLowerCase()}).catch(() => null);
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
