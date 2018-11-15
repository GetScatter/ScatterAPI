import "isomorphic-fetch"
import config from '../util/config'

// Once every 12 hours.
const intervalTime = 60000 * 60 * 12;
let interval;
let bucket;
const bucketKey = 'explorers';
const url = 'https://raw.githubusercontent.com/GetScatter/ScatterExplorers/master/explorers.json';


// Saving last prices in RAM, to alleviate DB calls.
// Mimics eventually persistent behavior.
let inRam;

export default class ExplorerService {

    static setBucket(_b){
        bucket = _b;
    }

    static async getApps(){
        if(!inRam) inRam = (await bucket.get(bucketKey)).value;
        return inRam;
    }

    static async watch(){
        clearInterval(interval);
        return new Promise(async resolve => {

            const set = async () => {
                if(!bucket) return;

                const explorers = await ExplorerService.getAll();
                if(explorers) {
                    await bucket.upsert(bucketKey, explorers);
                    inRam = explorers;
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
                console.log(err);
                return null;
            })
        ])
    }

}
