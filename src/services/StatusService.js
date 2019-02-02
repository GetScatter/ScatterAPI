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
        return Promise.all([
            fetch(`https://nodes.get-scatter.com/v1/chain/get_info`).then(x => x.json()).then(x => ({nodes:x.hasOwnProperty("chain_id")})).catch(() => ({nodes:false})),
            fetch(`https://api.get-scatter.com/v1/prices`).then(x => x.json()).then(x => ({api:x.hasOwnProperty('EOS')})).catch(() => ({api:false})),
            fetch(`https://api.light.xeos.me/api/account/eos/eosio?pretty=1`).then(x => x.json()).then(x => ({api:x.hasOwnProperty('account_name')})).catch(() => ({api:false})),
        ])
    }

}
