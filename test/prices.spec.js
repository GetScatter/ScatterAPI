import { assert } from 'chai';
import 'mocha';

import PriceService, {fetchers, PRICE_NETS} from '../src/services/PriceService';
import couchbase from '../src/database/couchbase'
// const bucket = couchbase('scatter');
// PriceService.setBucket(bucket);


describe('PriceService', () => {
    it('should be able to get prices', done => {
        new Promise(async() => {
            const prices = await fetchers[PRICE_NETS.EOS_MAINNET]();
            console.log('prices', prices);
            done();
        });
    });


});
