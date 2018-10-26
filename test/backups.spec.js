import { assert } from 'chai';
import 'mocha';

import Aes from 'aes-oop';

import BackupService from '../src/services/BackupService';
import couchbase from '../src/database/couchbase'
const bucket = couchbase('scatter');
BackupService.setBucket(bucket);

const password = 'testing_pass';
const ip = '111.111.111.111';
let authKey = '';
let privateKey = '';

describe('BackupService', () => {

    it('should be able to create a new backup', done => {
        new Promise(async() => {
            const proof = await BackupService.getEncryptableProof();
            const encryptedProof = Aes.encrypt(proof, password);

            const uuid = await BackupService.createBackup(ip, encryptedProof, "{testing_backup}", "test@get-scatter.com", "eos", "tx_id");
            console.log('uuid', uuid);
            assert(uuid, 'Could not create backup');
            done();
        });
    });

    it('should be able to authenticate', done => {
        new Promise(async() => {
            const proof = await BackupService.getEncryptionTester(uuid);
            const decryptedProof = Aes.decrypt(proof, password);

            const uuid = await BackupService.createBackup(ip, encryptedProof, "{testing_backup}", "test@get-scatter.com", "eos", "tx_id");
            console.log('uuid', uuid);
            assert(uuid, 'Could not create backup');
            done();
        });
    });

});
