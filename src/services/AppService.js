import "isomorphic-fetch"
import config from '../util/config'
import app from "../app";
import {flattenBlockchainObject} from "../util/blockchains";

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
	        await this.getApps();

            const set = async () => {
                if(!bucket) return;

                const apps = await AppService.getAll();
                if(apps) {

                    Object.keys(apps).map(blockchain => {
                        apps[blockchain].map(app => {
                            const rammed = inRam[blockchain].find(x => x.applink === app.applink);
                            if(!rammed) app.timestamp = +new Date();
                            else app.timestamp = rammed.hasOwnProperty('timestamp') ? rammed.timestamp : +new Date();
                        });
                    });


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
