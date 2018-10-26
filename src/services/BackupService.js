import config from '../util/config'
import createHash from 'create-hash';
const uuid4 = require('uuid/v4');
import ecc from 'eosjs-ecc';
import PriceService from './PriceService';

/***
 * Backups are double encrypted. Once with this servers password,
 * and then once with the users password. Neither can open without
 * the other's permission.
 */
const encKey = config('ENC_KEY');
import Aes from 'aes-oop';

let bucket;

const sha512 = data =>                          createHash('sha256').update(data).digest('hex');
const hashmail = email =>                       sha512(email.toLowerCase().trim());
const getRecoveryCodeKey = code =>              `recover:${code}`;
const emailToBackupKey = email =>               `email:${hashmail(email.toLowerCase().trim())}`;
const getProofKey = uuid =>                     `proof:${uuid}`;
const getAuthenticationKey = key =>             `auth:${key}`;
const getBackupKey = uuid =>                    `backup:${uuid}`;
const getEncryptableRandomKey = timestamp =>    `tester:${timestamp ? timestamp : startOfDay()}`;

const getTransactionKey = (blockchain, tx) =>   `tx:${blockchain.toLowerCase().trim()}:${tx.toLowerCase().trim()}`;

let testing = false;
const removeCodeInMinutes = 5;
const tokenExpiration = 1000*60*60*24*100;

const startOfDay = () => {
    const now = new Date();
    return +new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

const startOfWeek = () => {
    const d = new Date();
    const day = d.getDay(),
        diff = d.getDate() - day + (day === 0 ? -6:1);
    return +new Date(d.setDate(diff));
}

class Backup {
    constructor(ip, backups, email, paymentExpires){
        this.ip = ip;
        this.backups = backups; // [{data, timestamp}]
        this.email = email;
        this.paymentExpires = paymentExpires;
    }

    static placeholder(){ return new Backup(); }
    static fromJson(json){ return Object.assign(this.placeholder(), json); }
}

class Proof {
    constructor(proof, timestamp, lockedUntil = -1){
        this.proof = proof;
        this.timestamp = timestamp;
        this.lockedUntil = lockedUntil;
    }

    static placeholder(){ return new Proof(); }
    static fromJson(json){ return Object.assign(this.placeholder(), json); }
}

class PaymentTransaction {
    constructor(blockchain, transactionId){
        this.blockchain = blockchain;
        this.transactionId = transactionId;
    }

    static placeholder(){ return new PaymentTransaction(); }
    static fromJson(json){ return Object.assign(this.placeholder(), json); }
}

const ACCEPTABLE_BLOCKCHAINS = ['eos'];
class ClientPayment {
    constructor(uuid, paidUntil, transaction){
        this.uuid = uuid;
        this.paidUntil = paidUntil;
        this.transaction = transaction;
    }

    static placeholder(){ return new ClientPayment(); }
    static fromJson(json){
        let p = Object.assign(this.placeholder(), json);
        if(json.hasOwnProperty('transaction')) p.transaction = PaymentTransaction.fromJson(json.transaction);
        return p;
    }

    isValid(){
        if(!ACCEPTABLE_BLOCKCHAINS.includes(this.transaction.blockchain)) return false;
        if(!this.transaction.transactionId.length) return false;
        return true;
    }
}


const log = msg => console.log(`L-${new Date().toLocaleString()}: ${msg}`);
const err = msg => console.error(`E-${new Date().toLocaleString()}: ${msg}`);



export default class BackupService {

    static setBucket(_b){
        bucket = _b;
    }

    static setToTesting(){
        testing = true;
    }



    /****************************************************/
    /*                                                  */
    /*                     HELPERS                      */
    /*                                                  */
    /****************************************************/

    /***
     * Gets a new UUID for the database which is unclaimed.
     * @param formatter - A key formatter function
     * @returns {Promise.<*>}
     */
    static async getNewUUID(formatter){
        const uuid = uuid4();
        const exists = await bucket.exists(formatter(uuid));
        if(!exists) return uuid;
        else return this.getNewUUID(formatter);
    }








    /****************************************************/
    /*                                                  */
    /*                    PAYMENTS                      */
    /*                                                  */
    /****************************************************/


    static async validatePayment(blockchain, transactionId){
        const payment = new ClientPayment(null, null, PaymentTransaction.fromJson({blockchain, transactionId}));
        if(!payment.isValid()) return console.error('Invalid payment');

        if(testing) return payment;

        // TODO: Validate payments made in crypto from the blockchain.
        // Get current backup size. Cost = 0.5mb * $10/month
        return payment;
    }


    static async payForExistingAccount(uuid, blockchain, transactionId){
        if(!(await bucket.exists(getProofKey(uuid)))) return false;
        const payment = await this.validatePayment(blockchain, transactionId);
        if(!payment) return false;

        payment.uuid = uuid;

        //...
        return true;
    }




    /****************************************************/
    /*                                                  */
    /*                 EMAIL RECOVERY                   */
    /*                                                  */
    /****************************************************/


    /***
     * Sends a code to the email specified so that the user can
     * recover their UUID to be able to pull their encrypted Backup
     * @param ip
     * @param email
     */
    static async sendRecoveryCodeToEmail(ip, email){
        if(!(await bucket.exists(emailToBackupKey(email))))
            return false;

        let code = `${uuid4()}-`;
        code += sha512(email).slice(-6);
        await bucket.upsert(getRecoveryCodeKey(code), {ip, email});

        // Removes itself in 5 minutes
        setTimeout(async () => {
            bucket.exists(getRecoveryCodeKey(code)).then(exists => {
                if(exists) bucket.remove(getRecoveryCodeKey(code));
            })
        }, 1000*60*removeCodeInMinutes);

        if(testing){
            // TODO: Send email
        }

        return code;
    }

    /***
     * Validates the code sent to the email, and returns
     * the UUID.
     * @param ip
     * @param code
     */
    static async getUUIDFromRecoveryCode(ip, code){
        const found = await bucket.get(getRecoveryCodeKey(code)).catch(() => null).then(x => x.value);
        if(!found) return false;
        if(ip !== found.ip) return false;
        const {uuid} = await bucket.get(emailToBackupKey(found.email)).catch(() => ({uuid:null})).then(x => x.value);
        await bucket.remove(getRecoveryCodeKey(code));
        return uuid;
    }






    /****************************************************/
    /*                                                  */
    /*                 AUTHENTICATION                   */
    /*                                                  */
    /****************************************************/

    /***
     * Gets the proof key for a given day
     * Every day has a different proof key
     * @param timestamp
     */
    static async getEncryptableProof(timestamp){
        if(await bucket.exists(getEncryptableRandomKey(timestamp))) {
            return (await bucket.get(getEncryptableRandomKey(timestamp))).value.token;
        } else {
            const token = uuid4()+uuid4()+uuid4();
            // Possible race condition, recursing if so.
            if(await bucket.insert(getEncryptableRandomKey(timestamp), {token}).catch(() => null)){
                return token;
            } else return this.getEncryptableProof();
        }
    }

    /***
     * Gets a proof to be encrypted.
     * This proof serves as a middle ground between being able to fetch the actual
     * backup. If the user can no decrypt this proof, they can even get the backup.
     * @param uuid
     * @returns {Promise.<*>}
     */
    static async getEncryptionTester(uuid){
        if(!(await bucket.exists(getProofKey(uuid)))) return;
        const {proof} = (await bucket.get(getProofKey(uuid))).value;
        return proof;
    }

    /***
     * Validates the decrypted proof key against the given day's
     * proof key, which then either locks for N minutes on failure or provides an
     * authentication key and a private key for signing new updates with
     * @param uuid
     * @param cleartext
     */
    static async validateEncryptionTest(uuid, cleartext){
        let proof = await bucket.get(getProofKey(uuid)).catch(() => null).then(x => Proof.fromJson(x.value));
        if(!proof) return;

        const token = await this.getEncryptableProof(proof.timestamp);
        if(!token) return;

        if(+new Date() > proof.lockedUntil) {
            if (cleartext !== token) {
                // Locking for 10 minutes
                proof.lockedUntil = +new Date() + 1000 * 60 * 10;
                await bucket.upsert(getProofKey(uuid), proof);
                return console.error('locked');
            } else {
                const authKey = await this.getNewUUID(getAuthenticationKey);
                const privateKey = await ecc.randomKey();
                const publicKey = ecc.PrivateKey(privateKey).toPublic().toString();
                await bucket.upsert(getAuthenticationKey(authKey), {uuid, publicKey});
                return [authKey, privateKey];
            }
        } else return console.error('locked');
    }









    /****************************************************/
    /*                                                  */
    /*                  BACKUP LOGIC                    */
    /*                                                  */
    /****************************************************/

    /***
     * Gets a user and their current public key from an authentication key
     * @param authKey
     */
    static async getUserFromAuthKey(authKey){
        return bucket.get(getAuthenticationKey(authKey))
            .catch(() => [null])
            .then(x => {
                if(!x || !x.value) return [null];
                return [x.value.uuid, x.value.publicKey]
            })
    }

    /***
     * Gets a backup that can be decrypted on the user's machine
     * @param ip
     * @param authKey
     */
    static async getBackup(ip, authKey){
        const [uuid, publicKey] = await this.getUserFromAuthKey(authKey);
        if(!uuid) return false;

        const backup = await bucket.get(getBackupKey(uuid)).catch(() => null).then(x => Backup.fromJson(x.value));
        if(!backup) return false;

        // Authentication is either broken or stale, failing.
        if(ip !== backup.ip) {
            await bucket.remove(getAuthenticationKey(authKey));
            return false;
        }

        return JSON.stringify(Aes.decrypt(backup.backups[0].data, encKey));
    }

    /***
     * Updates a backup for the user. Must also be signed with the
     * private key associated with their current authentication
     * @param ip
     * @param authKey
     * @param backupData
     * @param signedBackup
     * @param encryptedProof
     */
    static async updateBackup(ip, authKey, backupData, signedBackup, encryptedProof = null){
        const [uuid, publicKey] = await this.getUserFromAuthKey(authKey);
        if(!uuid) return false;

        if(!(await bucket.exists(getBackupKey(uuid)))) return console.error('No backup');

        const backup = await bucket.get(getBackupKey(uuid)).catch(() => null).then(x => Backup.fromJson(x.value));
        if(!backup) return console.error('no backup');

        // Authentication is either broken or stale, failing.
        if(ip !== backup.ip || ecc.recover(signedBackup, JSON.stringify(backupData)) !== publicKey) {
            await bucket.remove(getAuthenticationKey(authKey));
            return console.error('bad auth');
        }

        // Remove any latest backups
        backup.backups = backup.backups.filter(x => x.timestamp !== startOfWeek());
        // Add new latest backup
        backup.backups.unshift({timeStamp:startOfWeek(), data:Aes.encrypt(backupData, encKey)});
        // Remove any backup over 4 weeks old
        if(backup.backups.length > 4) backup.backups.pop();
        // Update database entry
        await bucket.upsert(getBackupKey(uuid),backup);

        if(encryptedProof) {
            const proof = new Proof(encryptedProof, startOfDay());
            await bucket.upsert(getProofKey(uuid), proof);
        }

        return true;
    }

    /***
     * Creates a backup for a new user
     * @param ip
     * @param encryptedProof
     * @param backupData
     * @param email
     * @param blockchain
     * @param transactionId
     */
    static async createBackup(ip, encryptedProof, backupData, email, blockchain, transactionId){
        if(await bucket.exists(emailToBackupKey(email))) {
            console.error('Email already exists');
            return false;
        }

        const payment = await this.validatePayment(blockchain, transactionId);
        if(!payment) return false;

        const uuid = await this.getNewUUID(getProofKey);
        payment.uuid = uuid;

        const proof = new Proof(encryptedProof, startOfDay());
        const backup = new Backup(ip, [{timestamp:startOfWeek(), data:Aes.encrypt(backupData, encKey)}], email);
        await bucket.insert(emailToBackupKey(email), {uuid});
        await bucket.insert(getBackupKey(uuid), backup);
        await bucket.insert(getProofKey(uuid), proof);

        return uuid;
    }

    static async removeAll(ip, authKey, signedAuthKey){
        const [uuid, publicKey] = await this.getUserFromAuthKey(authKey);
        if(!uuid) return console.error('no uuid');

        const backup = await bucket.get(getBackupKey(uuid)).catch(() => null).then(x => Backup.fromJson(x.value));
        if(!backup) return console.error('no backup');

        // Authentication is either broken or stale, failing.
        if(ip !== backup.ip || ecc.recover(signedAuthKey, authKey) !== publicKey) {
            await bucket.remove(getAuthenticationKey(authKey));
            return console.error('no auth');
        }

        await bucket.remove(getAuthenticationKey(authKey));
        await bucket.remove(getProofKey(uuid));
        await bucket.remove(getBackupKey(uuid));
        await bucket.remove(emailToBackupKey(backup.email));

        return true;
    }


    // TODO: TESTING ONLY
    static async deleteFromEmail(email){
        if(!(await bucket.exists(emailToBackupKey(email)))) return;
        const {uuid} = await bucket.get(emailToBackupKey(email)).catch(() => ({uuid:null})).then(x => x.value);
        if(!uuid) return;
        await bucket.remove(getProofKey(uuid));
        await bucket.remove(getBackupKey(uuid));
        await bucket.remove(emailToBackupKey(email));
        return true;
    }

}