import "isomorphic-fetch"
import config from '../util/config'
import Eos from 'eosjs';
const {ecc} = Eos.modules;

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

    static async createEosAccount(name, keys, leftForResources, paymentTx, signature){
    	try {
		    if(!ecc.recover(signature, keys.active)){
			    console.error('Signature did not match: ', paymentTx);
			    return false;
		    }
	    } catch(e){
		    console.error('Signature did not match: ', paymentTx);
    		return false;
	    }

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

        return ((ramPrice * 4096) + 1).toFixed(4);
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
