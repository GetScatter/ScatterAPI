import { assert } from 'chai';
import 'mocha';

import Aes from 'aes-oop';
import ecc from 'eosjs-ecc';

import PriceService from '../src/services/PriceService';
import BackupService from '../src/services/BackupService';
import couchbase from '../src/database/couchbase'
const bucket = couchbase('scatter');
BackupService.setBucket(bucket);
PriceService.setBucket(bucket);

const email = "test@get-scatter.com";
const ip = '111.111.111.111';

let password = 'testing_pass';
let testBackup = {testing_backup:'hi'};
let encBackup = Aes.encrypt(testBackup, password);
const tx = 'f617db367ca64b331c7d4091face0d9490e7c0f0254a33c6fd620cd1f03ab20b';

let authKey, uuid, privateKey;

describe('BackupService', () => {



    it('should clean up the db', done => {
        new Promise(async() => {
            await BackupService.deleteFromEmail(email);
            done();
        });
    });

    it('should be able to create a new backup', done => {
        new Promise(async() => {
            const proof = await BackupService.getEncryptableProof();
            const encryptedProof = Aes.encrypt(proof, password);

            uuid = await BackupService.createBackup(ip, encryptedProof, encBackup, email, "eos", tx);
            assert(uuid, 'Could not create backup');
            done();
        });
    });

    it('should be able to authenticate', done => {
        new Promise(async() => {
            const proof = await BackupService.getEncryptionTester(uuid);
            const decryptedProof = Aes.decrypt(proof, password);
            assert(decryptedProof, 'Could not get decrypted proof')

            const auth = await BackupService.validateEncryptionTest(uuid, decryptedProof);
            assert(auth && auth.length === 2, "Could not get auth");
            authKey = auth[0];
            privateKey = auth[1];
            assert(authKey, 'Could not get authKey');
            assert(privateKey, 'Could not get privateKey');
            done();
        });
    });

    it('should be able to get a backup', done => {
        new Promise(async() => {
            const backup = await BackupService.getBackup(ip, authKey);
            assert(backup === encBackup, "Could not get backup");
            const decryptedBackup = Aes.decrypt(backup, password);
            assert(JSON.stringify(decryptedBackup) === JSON.stringify(testBackup));
            done();
        });
    });

    it('should be able to update a backup', done => {
        new Promise(async() => {
            testBackup = {hello:'world'};
            encBackup = Aes.encrypt(testBackup, password);

            const updated = await BackupService.updateBackup(ip, authKey, encBackup, ecc.sign(JSON.stringify(encBackup), privateKey));
            assert(updated, "Could not update backup");

            const backup = await BackupService.getBackup(ip, authKey);
            assert(backup === encBackup, "Could not get backup");
            const decryptedBackup = Aes.decrypt(backup, password);
            assert(JSON.stringify(decryptedBackup) === JSON.stringify(testBackup));
            done();
        });
    });

    it('should be able to update a backup with a new password', done => {
        new Promise(async() => {
            const proof = await BackupService.getEncryptionTester(uuid);
            const decryptedProof = Aes.decrypt(proof, password);

            password = 'changed_password'
            testBackup = {hello:'world2'};
            encBackup = Aes.encrypt(testBackup, password);

            const reEncryptedProof = Aes.encrypt(decryptedProof, password);

            const updated = await BackupService.updateBackup(ip, authKey, encBackup, ecc.sign(JSON.stringify(encBackup), privateKey), reEncryptedProof);
            assert(updated, "Could not update backup");

            const backup = await BackupService.getBackup(ip, authKey);
            assert(backup === encBackup, "Could not get backup");
            const decryptedBackup = Aes.decrypt(backup, password);
            assert(JSON.stringify(decryptedBackup) === JSON.stringify(testBackup));
            done();
        });
    });

    it('should be able to recover uuid from email code', done => {
        new Promise(async() => {
            const code = await BackupService.sendRecoveryCodeToEmail(ip, email);
            assert(code, "Could not get recovery code");

            const recoveryUuid = await BackupService.getUUIDFromRecoveryCode(ip, code);
            assert(uuid === recoveryUuid, "Recovery uuid did not match");
            done();
        });
    });

    it('should delete all records', done => {
        new Promise(async() => {
            await BackupService.removeAll(ip, authKey, ecc.sign(authKey, privateKey));
            done();
        });
    });

});
