import Eos from 'eosjs';
import config from '../util/config'

const PAYMENT_ACCOUNTS = {
    EOS:config('BACKUP_PAYMENTS_EOS')
}

const eos = Eos({httpEndpoint:'https://nodes.get-scatter.com'});

export default class TransactionService {

    static async eos(transactionId, minimum){
        const result = await eos.getTransaction(transactionId).catch(() => null);
        if(!result) return false;

        // console.log('result',result);

        const {trx, id} = result;

        if(id !== transactionId) return false;
        if(!trx.hasOwnProperty('receipt')) return false;

        const {actions, expiration} = trx.trx;
        const trxDate = new Date(expiration);
        const now = new Date();
        if(trxDate.getFullYear() !== now.getFullYear()) return false;
        if(trxDate.getMonth() !== now.getMonth()) return false;
        if(trxDate.getDate() !== now.getDate()) return false;
        if(actions.length !== 1) return false;

        const action = actions[0];
        const {account, name, data} = action;
        const {from, to, quantity, memo} = data;

        if(account !== 'eosio.token') return false;
        if(name !== 'transfer') return false;
        if(to !== PAYMENT_ACCOUNTS.EOS) return false;
        let [amount, symbol] = quantity.split(' ');
        amount = parseFloat(amount).toFixed(4);
        if(amount < minimum) return false;
        if(symbol !== 'EOS') return false;
        return quantity;
    }

}