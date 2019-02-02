import "isomorphic-fetch"
import config from '../util/config'

// Once every minute.
const intervalTime = 1000 * 60;
let interval;

// Saving last prices in RAM, to alleviate DB calls.
// Mimics eventually persistent behavior.
let inRam;

export default class StatusService {

    static getStatuses(){ return inRam; }

    static async watch(){
        clearInterval(interval);
        return new Promise(async resolve => {

            const set = async () => {
                inRam = await StatusService.getAll();
                resolve(true);
            };

            await set();
            interval = setInterval(async () => {
                await set();
            }, intervalTime);
        })
    }

    static getAll(){
        const generalApi = status => ({
	        type:'generalApi',
	        description:'Prices, price graphs, exchange data.',
	        status
        });

        const tokenApi = status => ({
	        type:'tokenApi',
	        description:'Token and account data.',
	        status
        });

        const nodeBalancer = status => ({
            type:'nodeBalancer',
            description:'Load balances EOSIO nodes',
            status
        })

        return Promise.all([
            fetch(`https://nodes.get-scatter.com/v1/chain/get_info`).then(x => x.json()).then(x => nodeBalancer(x.hasOwnProperty("chain_id"))).catch(() => nodeBalancer(false)),
            fetch(`https://api.get-scatter.com/v1/prices`).then(x => x.json()).then(x => generalApi(x.hasOwnProperty('EOS'))).catch(() => generalApi(false)),
            fetch(`https://api.light.xeos.me/api/account/eos/eosio?pretty=1`).then(x => x.json()).then(x => tokenApi(x.hasOwnProperty('account_name'))).catch(() => tokenApi(false)),
        ])
    }

}
