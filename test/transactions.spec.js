import { assert } from 'chai';
import 'mocha';

import TransactionService from '../src/services/TransactionService';


describe('TransactionService', () => {
    it('should be able to get an eos transaction', done => {
        new Promise(async() => {
            assert(await TransactionService.checkeos('f617db367ca64b331c7d4091face0d9490e7c0f0254a33c6fd620cd1f03ab20b', '1.0000 EOS'), "Transaction did not validate");
            done();
        });
    });

    it('should be able to validate eos transactions', done => {
        new Promise(async() => {
            assert(!(await TransactionService.checkeos('f617db367ca64b331c7d4091face0d9490e7c0f0254a33c6fd620cd1f03ab20b', '1.0001 EOS')), "Transaction validated when it shouldn't have");
            assert(!(await TransactionService.checkeos('f617db367ca64b331c7d4091face0d9490e7c0f0254a33c6fd620cd1f03ab20b', '1.0000 EOSQ')), "Transaction validated when it shouldn't have");
            assert(!(await TransactionService.checkeos('21447c5f22d13866c770b70720bd810dcea4feda42d0723a7903765856d9ddd5', '0.0038 EOS')), "Transaction validated when it shouldn't have");
            done();
        });
    });


});
