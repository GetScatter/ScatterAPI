import Eos from 'eosjs';

const eos = Eos({httpEndpoint:'https://nodes.get-scatter.com'});

export default class TransactionService {

    static async checkeos(transactionId, requiredQuantity){
        const result = await eos.getTransaction(transactionId);
        if(!result) return false;

        const {trx, id} = result;

        if(id !== transactionId) return false;
        if(!trx.hasOwnProperty('receipt')) return false;

        const {actions} = trx.trx;
        if(actions.length !== 1) return false;

        const action = actions[0];
        const {account, name, data} = action;
        const {from, to, quantity, memo} = data;

        if(account !== 'eosio.token') return false;
        if(name !== 'transfer') return false;
        if(to !== 'scatterfunds') return false;
        return quantity === requiredQuantity;
    }

}