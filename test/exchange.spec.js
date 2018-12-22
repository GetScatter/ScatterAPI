import { assert } from 'chai';
import 'mocha';

import ExchangeService from '../src/services/ExchangeService';

const exchange = new ExchangeService('127.0.0.1');

describe('ExchangeService', () => {


    // it('should be able to get coins', done => {
    //     new Promise(async() => {
    //         const coins = await ExchangeService.coins();
    //         console.log('coins', coins);
    //         done();
    //     });
    // });

    it('should be able to get pairs', done => {
        new Promise(async() => {
            const coins = await exchange.pairs('eos', 'btc');
            console.log('coins', coins);
            done();
        });
    });

    it('should be able to get a rate for a pair', done => {
        new Promise(async() => {
            const coins = await exchange.rate('eos', 'btc');
            console.log('coins', coins);
            done();
        });
    });


});
