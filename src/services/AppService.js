import "isomorphic-fetch"
import config from '../util/config'

// Once every 30 minutes.
const intervalTime = 60000 * 30;
let interval;
let bucket;
const bucketKey = 'apps';
const url = 'https://raw.githubusercontent.com/GetScatter/ScatterApps/master/apps.json';


// Saving last prices in RAM, to alleviate DB calls.
// Mimics eventually persistent behavior.
let inRam;

export default class AppService {

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

                const apps = await AppService.getAll();
                if(apps) {
                    await bucket.upsert(bucketKey, apps);
                    inRam = apps;
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
