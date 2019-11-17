import { assert } from 'chai';
import 'mocha';

import ExchangeService from '../src/services/ExchangeService';

const exchange = new ExchangeService('127.0.0.1');
let orderId = null;

describe('ExchangeService', () => {


    // it('should be able to get coins', done => {
    //     new Promise(async() => {
    //         const coins = await ExchangeService.coins();
    //         console.log('coins', coins);
    //         done();
    //     });
    // });

    // it('should be able to get pairs', done => {
    //     new Promise(async() => {
    //         const coins = await exchange.pairs('eos', 'btc');
    //         console.log('coins', coins);
    //         done();
    //     });
    // });
    //
    // it('should be able to get a rate for a pair', done => {
    //     new Promise(async() => {
    //         const coins = await exchange.rate('eos', 'btc');
    //         console.log('coins', coins);
    //         done();
    //     });
    // });

    it('should be able to create an order', done => {
        new Promise(async() => {
            const order = await exchange.createOrder(
                'coinswitch',
                {
                    blockchain:'eos',
	                chainId: "aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906",
	                contract: "eosio.token",
	                createdAt: 1573949601324,
	                decimals: "4",
	                fromOrigin: "",
	                id: "0oIfJjF5EIZ4EkprL7zjZt8u",
	                name: "EOS",
	                symbol: "EOS",
	                unusable: null
                },
                'ETH',
                2,
                {account:'ramdeathtest'},
                {account:'ramdeathtest'}
            );
            console.log('order', order);
            done();
        });
    });

    it('should be able to cancel an order', done => {
        new Promise(async() => {
            if(orderId) await ExchangeService.cancelled(orderId);
            done();
        });
    });


});
