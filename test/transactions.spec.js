import { assert } from 'chai';
import 'mocha';

import TransactionService from '../src/services/TransactionService';

describe('TransactionService', () => {
    it('should be able to get an eos transaction', done => {
        new Promise(async() => {
            const amount = await TransactionService.eos('f617db367ca64b331c7d4091face0d9490e7c0f0254a33c6fd620cd1f03ab20b', 1);
            assert(amount, "Transaction did not validate");
            console.log('amount', amount);

            assert(!(await TransactionService.eos('f417db367ca64b331c7d4091face0d9490e7c0f0254a33c6fd620cd1f03ab20b', 1)), "Validated bad transaction");
            assert(!(await TransactionService.eos('191d1627c53abccfecf51253e70199f397380a9bdf951e81f4a74b6c3387c3ac', 1)), "Validated bad transaction");
            done();
        });
    });


});
