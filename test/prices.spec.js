import { assert } from 'chai';
import 'mocha';

import PriceService from '../src/services/PriceService';
import couchbase from '../src/database/couchbase'
const bucket = couchbase('scatter');
PriceService.setBucket(bucket);


describe('PriceService', () => {
    it('should be able to get an eos transaction', done => {
        new Promise(async() => {
            const time = await PriceService.getBackupTimePaidFor('eos', '0.5000 EOS');
            console.log('time', time);
            done();
        });
    });


});
