import config from '../util/config'
import createHash from 'create-hash';
const uuid4 = require('uuid/v4');
import ecc from 'eosjs-ecc';

/***
 * Backups are double encrypted. Once with this servers password,
 * and then once with the users password. Neither can open without
 * the other's permission.
 */
const encKey = config('ENC_KEY');
import Aes from 'aes-oop';

let bucket;

const sha512 = data => createHash('sha256').update(data).digest('hex');
const hashmail = email => sha512(email.trim());
const getRecoveryCodeKey = code =>              `recover:${code}`;
const emailToBackupKey = email =>               `email:${hashmail(email)}`;
const getProofKey = uuid =>                     `proof:${uuid}`;
const getAuthenticationKey = key =>             `auth:${key}`;
const getBackupKey = uuid =>                    `backup:${uuid}`;
const getEncryptableRandomKey = timestamp =>    `tester:${timestamp ? timestamp : startOfDay()}`;

const removeCodeInMinutes = 1;
const tokenExpiration = 1000*60*60*24*100;

const startOfDay = () => {
    const now = new Date();
    return +new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

class Backup {
    constructor(ip, backup, email){
        this.ip = ip;
        this.backup = backup;
        this.email = email;
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

    static placeholder(){ return new Backup(); }
    static fromJson(json){ return Object.assign(this.placeholder(), json); }
}

export default class BackupService {

    static setBucket(_b){
        bucket = _b;
    }


    /***
     * Gets a new UUID for the database which is unclaimed.
     * @param formatter - A key formatter function
     * @returns {Promise.<*>}
     */
    static async getNewUUID(formatter){
        const uuid = uuid4();
        const exists = await bucket.exists(formatter(uuid));
        if(!exists) return uuid;
        else return this.getNewUUID();
    }

    /***
     * Sends a code to the email specified so that the user can
     * recover their UUID to be able to pull their encrypted Backup
     * @param ip
     * @param email
     * @returns {Promise.<*>}
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

        return code;
    }

    /***
     * Validates the code sent to the email, and returns
     * the UUID.
     * @param ip
     * @param code
     * @returns {Promise.<*>}
     */
    static async getUUIDFromRecoveryCode(ip, code){
        const found = await bucket.get(getRecoveryCodeKey(code)).catch(() => null).then(x => x.value);
        if(!found) return false;
        if(ip !== found.ip) return false;
        const {uuid} = await bucket.get(emailToBackupKey(found.email)).catch(() => ({uuid:null})).then(x => x.value);
        await bucket.remove(getRecoveryCodeKey(code));
        return uuid;
    }



    /***
     * Gets the proof key for a given day
     * Every day has a different proof key
     * @param timestamp
     * @returns {Promise.<*>}
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
        const {proof} = await bucket.get(getProofKey(uuid));
        return proof;
    }

    /***
     * Validates the decrypted proof key against the given day's
     * proof key, which then either locks for N minutes on failure or provides an
     * authentication key and a private key for signing new updates with
     * @param uuid
     * @param cleartext
     * @returns {Promise.<*>}
     */
    static async validateEncryptionTest(uuid, cleartext){
        let {proof, timestamp, lockedUntil} = await bucket.get(getProofKey(uuid));
        if(+new Date() < lockedUntil) return console.error('locked');
        const {token} = await this.getEncryptableProof(timestamp);
        if(cleartext !== token){
           // Locking for 10 minutes
           lockedUntil = +new Date() + 1000*60*10;
           await bucket.upsert(getProofKey(uuid), new Proof(proof, timestamp, lockedUntil));
           return console.error('locked');
        } else {
            const authKey = await this.getNewUUID(getAuthenticationKey);
            const privateKey = ecc.randomKey();
            const publicKey = privateKey.toPublic();
            await bucket.upsert(getAuthenticationKey(authKey), {uuid, publicKey});
            return [authKey, privateKey.toWif()];
        }
    }

    /***
     * Gets a user and their current public key from an authentication key
     * @param authKey
     * @param callback
     */
    static getUserFromAuthKey(authKey, callback){
        bucket.get(getAuthenticationKey(authKey)).catch(() => ({uuid:null})).then(({uuid, publicKey}) => {
            callback(uuid, publicKey);
        })
    }

    /***
     * Gets a backup that can be decrypted on the user's machine
     * @param ip
     * @param authkey
     * @returns {Promise.<void>}
     */
    static async getBackup(ip, authkey){
        this.getUserFromAuthKey(authkey, async uuid => {
            if(!uuid) return false;
            const backup = await bucket.get(getBackupKey(uuid)).catch(() => null).then(x => Backup.fromJson(x.value));
            if(!backup) return false;
            if(ip !== backup.ip) {
                bucket.delete(getAuthenticationKey(authkey));
                return false;
            }
            return Aes.decrypt(backup.backup, encKey);
        })
    }

    /***
     * Updates a backup for the user. Must also be signed with the
     * private key associated with their current authentication
     * @param ip
     * @param authKey
     * @param backup
     * @param signedBackup
     */
    static updateBackup(ip, authKey, backup, signedBackup){
        this.getUserFromAuthKey(authKey, async (uuid, publicKey) => {
            if(!uuid) return false;
            const oldBackup = await bucket.get(getBackupKey(uuid)).catch(() => null).then(x => Backup.fromJson(x.value));
            if(!oldBackup) return false;

            if(ip !== oldBackup.ip || ecc.recover(signedBackup, JSON.stringify(backup)) !== publicKey) {
                bucket.delete(getAuthenticationKey(authKey));
                return false;
            }

            await bucket.upsert(getBackupKey(uuid), new Backup(ip, Aes.encrypt(backup, encKey)));
            return true;
        })
    }

    /***
     * Creates a backup for a new user
     * @param ip
     * @param encryptedProof
     * @param backupData
     * @param email
     * @returns {Promise.<void>}
     */
    static async createBackup(ip, encryptedProof, backupData, email){
        const uuid = await this.getNewUUID(getProofKey);
        const proof = new Proof(encryptedProof, startOfDay());
        const backup = new Backup(ip, Aes.encrypt(backupData, encKey), email);
        await bucket.insert(emailToBackupKey(email), {uuid});
        await bucket.insert(getBackupKey(uuid), backup);
        await bucket.insert(getProofKey(uuid), proof);
    }

}