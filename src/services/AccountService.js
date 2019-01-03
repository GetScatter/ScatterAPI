import "isomorphic-fetch"
import config from '../util/config'
import Eos from 'eosjs';
const {ecc} = Eos.modules;
const murmur = require('murmurhash');

let bucket;
const transactionKey = id => `tx:${id}`;

const creator = config('ACCOUNT_CREATOR_NAME');
const keyProvider = config('ACCOUNT_CREATOR_KEY');

let eosInstance;

const getNewEosInstance = () => Eos({
	httpEndpoint:`https://nodes.get-scatter.com`,
	chainId:'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
    keyProvider
});

// const getNewEosInstance = () => Eos({
// 	httpEndpoint:`http://192.168.1.9:8888`,
// 	chainId:'cf057bbfb72640471fd910bcb67639c22df9f92470936cddc1ade0e2f2e7dc4f',
//     keyProvider
// });

const getEos = async (attempts = 0) => {
    if(!eosInstance) eosInstance = getNewEosInstance();
    const connectionTest = await eosInstance.getInfo({}).then(() => true).catch(() => false);

    if(!connectionTest) {
        if(attempts >= 5) {
        	console.error('could not get EOS instance');
        	return null;
        }
        return getEos(attempts++);
    }

    return eosInstance;
};

export default class AccountService {

    static setBucket(_b){
        bucket = _b;
    }

    static async checkMachineId(machineId){
    	if(!machineId || !machineId.length) return true;
    	return bucket.exists(`machine:${machineId}`).catch(() => true);
    }

    static async checkIp(ip){
    	if(!ip || !ip.length) return true;
    	return bucket.exists(`ip:${ip}`).catch(() => true);
    }

    static async logCreation(ip, machineId){
	    await bucket.insert(`machine:${machineId}`, {}).catch(() => true);
	    await bucket.insert(`ip:${ip}`, {}).catch(() => true);
	    return true;
    }

    static sha256(data){
    	return ecc.sha256(data);
    }

    static async getBridgeBalance(publicKey){
	    const eos = await getEos();
	    if(!eos) return null;
	    return eos.getTableRows({
		    json:true,
		    code:'createbridge',
		    scope:'createbridge',
		    table:'balances',
		    lower_bound:murmur.v2(publicKey),
		    upper_bound:murmur.v2(publicKey)+1
	    }).then(res => res.rows[0]).catch(() => null);
    }

    static proveSignature(signature, key, hash = null){
	    try {
	    	return key === hash ? ecc.recoverHash(signature, key) : ecc.recover(signature, key);
	    } catch(e){
		    console.error('Signature did not match: ', key);
		    return false;
	    }
    }

    static async canCreateBridge(publicKey, signature){
    	// Proving balance existence
    	const balance = await this.getBridgeBalance(publicKey);
    	if(!balance) return {error:"Could not find any balance for this public key"};

    	// Proving ownership of balance
	    if(!this.proveSignature(signature, this.sha256(publicKey)))
		    return {error:"Signature did not match public key"};

	    // Proving irreversibility
    	const now = +new Date();
    	const irreversibleTime = +new Date((balance.timestamp*1000) + (1000*60*3.2));
    	if(now < irreversibleTime)
    		return {error:"Transaction is not yet irreversible."};

    	return true;
    }

	static async createBridgeAccount(name, key, free = false){
		const eos = await getEos();
		if(!eos) return null;
		const contract = await eos.contract('createbridge');
		if(!contract) return null;
		return await contract.create(key, name, key, free ? "get-scatter.com" : key, {authorization:`createbridge@active`})
			.then(async () => true)
			.catch(err => {
				console.error('Bridge creation error', JSON.parse(err).error.what);
				return {error:JSON.parse(err).error.what};
			});
	}

    static async createEosAccount(name, keys, leftForResources, paymentTx, signature){
    	if(!this.proveSignature(signature, keys.active)) return false;

    	if(await bucket.exists(transactionKey(paymentTx))){
    		console.error('Tried to create another account: ', paymentTx, name);
    	    return false;
	    }

	    const eos = await getEos();
	    if(!eos) return null;

	    const net = (leftForResources/4).toFixed(4);
	    const cpu = (leftForResources-net).toFixed(4);
	    const {active, owner} = keys;

	    const savedTransaction = { name, keys };
	    const inserted = await bucket.insert(transactionKey(paymentTx), savedTransaction).then(() => true).catch(() => false);
	    if(!inserted) return false;

	    const created = await Promise.race([
		    new Promise(resolve => setTimeout(() => resolve(false), 10000)),
		    eos.transaction(tr => {
			    tr.newaccount({
				    creator: creator,
				    name: name,
				    owner,
				    active
			    });
			    tr.buyrambytes({
				    payer:creator,
				    receiver:name,
				    bytes:4096
			    });
			    tr.delegatebw({
				    from: creator,
				    receiver: name,
				    stake_net_quantity: `${net} EOS`,
				    stake_cpu_quantity: `${cpu} EOS`,
				    transfer: 1
			    })
		    }).then(trx => trx.transaction_id).catch(err => {
		    	console.error(err);
		    	return false;
		    })
	    ]);

	    if(!created){
	    	await bucket.remove(transactionKey(paymentTx)).catch(() => false);
	    } else {
		    savedTransaction.creation = created;
		    await bucket.upsert(transactionKey(paymentTx), savedTransaction).catch(() => false);
	    }

	    return created;
    }

    static async getAccountMinimumCost(){
        const eos = await getEos();
        if(!eos) return null;
        const ramPrice = await AccountService.getRamPrice(eos);
        if(!ramPrice) return null;

        return ((ramPrice * 4096) + 0.8).toFixed(4);
    }

	static async getRamPrice(eos){

		const parseAsset = asset => asset.split(' ')[0];
		const getRamInfo = async () => eos.getTableRows({
			json:true,
			code:'eosio',
			scope:'eosio',
			table:'rammarket'
		}).then(res => {
			const ramInfo = res.rows[0];
			return [parseAsset(ramInfo.quote.balance), parseAsset(ramInfo.base.balance)];
		}).catch(() => false);

		const ramInfo = await getRamInfo();
		if(!ramInfo) return null;
		return (ramInfo[0] / ramInfo[1]).toFixed(8);
	}

}
