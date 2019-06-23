import "isomorphic-fetch"
import config from '../util/config'
import {convertBlockchain} from "../util/blockchains";

// Once every 12 hours.
const intervalTime = 60000 * 60 * 24;
let interval;
let bucket;
const bucketKey = 'networks';
const url = 'https://raw.githubusercontent.com/GetScatter/ScatterNetworks/master/networks.json';


// Saving last prices in RAM, to alleviate DB calls.
// Mimics eventually persistent behavior.
let inRam;

export default class NetworkService {

    static setBucket(_b){
        bucket = _b;
    }

    static async getNetworks(){
        if(!inRam) inRam = (await bucket.get(bucketKey)).value;
        return inRam;
    }

    static async watch(){
        clearInterval(interval);
        return new Promise(async resolve => {

            const set = async () => {
                if(!bucket) return;

                const entries = await NetworkService.getAll();
                console.log(entries);
                if(entries) {
                    Object.keys(entries).map(b => {
                        const blockchain = convertBlockchain(b);
                        entries[b].map(network => {
                            network.blockchain = blockchain;
                            if(network.hasOwnProperty('token') && network.token){
                                network.token.blockchain = blockchain;
                            }
                        })
                    });


                    await bucket.upsert(bucketKey, entries);
                    inRam = entries;
                }

                resolve(true);
            };

            await set();
            interval = setInterval(async () => {
                await set();
            }, intervalTime);
        })
    }

    static getAll(){
        return Promise.race([
            new Promise(resolve => setTimeout(() => resolve(false), 2500)),
            fetch(url+`?rand=${Math.random() * 10000 + 1}`, {
                json: true,
                gzip: true
            }).then(x => x.json()).then(res => {
                return res;
            }).catch(err => {
                console.error(err);
                return null;
            })
        ])
    }

}
