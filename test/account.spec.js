import { assert } from 'chai';
import 'mocha';
import Eos from 'eosjs';
const {ecc} = Eos.modules;

import AccountService from '../src/services/AccountService';

describe('Create EOS Accounts', () => {

    const privateKey = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3';
    const publicKey = 'EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV';

    it('should be able to check the existence of an account balance', done => {
        new Promise(async() => {
            const balance = await AccountService.getBridgeBalance(publicKey);
	        console.log('balance', balance);
	        assert(balance, "Could not get balance object");
            done();
        });
    });

    it('should be able to verify a signature', done => {
        new Promise(async() => {
            const signature = ecc.sign(publicKey, privateKey);
            const valid = AccountService.proveSignature(signature, publicKey);
	        console.log('Valid', valid, signature);
	        assert(valid, "Could not validate signature");
            done();
        });
    });

    it('should be able to approve creation', done => {
        new Promise(async() => {
	        const signature = ecc.sign(publicKey, privateKey);
            const canCreate = await AccountService.canCreateBridge(publicKey, signature);
	        console.log('canCreate', canCreate);
	        assert(canCreate === true, canCreate);
            done();
        });
    });

    it('should be able to create account', done => {
        new Promise(async() => {
            const created = await AccountService.createBridgeAccount("scattertttst", publicKey);
            console.log('created', created);
            done();
        });
    });


});
