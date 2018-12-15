import Eos from 'eosjs';
import config from '../util/config'

export const PAYMENT_ACCOUNTS = {
    EOS:{
	    BACKUP_PAYMENT:config('BACKUP_PAYMENTS_EOS'),
	    NEW_ACCOUNT:config('ACCOUNT_CREATOR_NAME'),
    }
};

const eosEndpoint = 'https://nodes.get-scatter.com';

export default class TransactionService {

    static async eos(transactionId, minimum, paymentAccount){

        const getTransaction = () => Promise.race([
	        new Promise(resolve => setTimeout(() => resolve(null), 2500)),
	        fetch(`${eosEndpoint}/v1/history/get_transaction`, {
		        method: 'POST',
		        headers:{
			        'Accept': 'application/json',
			        'Content-Type': 'application/json'
		        },
		        body:JSON.stringify({ id:transactionId })
	        }).then(r => r.json()).catch(()=>false)
        ]);

        const transaction = await getTransaction();
        if(!transaction) return false;

        const {trx, id, block_num, last_irreversible_block} = transaction;

        // Only irreversible
        if(last_irreversible_block < block_num) return {error:'Not yet irreversible'};

        if(id !== transactionId) return false;
        if(!trx.hasOwnProperty('receipt')) return false;

        const {actions, expiration} = trx.trx;
        const trxDate = new Date(expiration);
        // const now = new Date();
        // if(trxDate.getFullYear() !== now.getFullYear()) return false;
        // if(trxDate.getMonth() !== now.getMonth()) return false;
        // if(trxDate.getDate() !== now.getDate()) return false;
        if(actions.length !== 1) return false;

        const action = actions[0];
        const {account, name, data} = action;
        const {from, to, quantity, memo} = data;

        if(account !== 'eosio.token') return false;
        if(name !== 'transfer') return false;
        if(to !== paymentAccount) return false;
        let [amount, symbol] = quantity.split(' ');
        amount = parseFloat(amount).toFixed(4);
        if(amount < minimum) return false;
        if(symbol !== 'EOS') return false;
        return [amount, memo];
    }

}