import "isomorphic-fetch"
import config from '../util/config'

// Once every 30 minutes.
const intervalTime = 60000 * 30;
let appsInterval;
let bucket;


// Saving last prices in RAM, to alleviate DB calls.
// Mimics eventually persistent behavior.
let appsInRam;

export default class AppService {

    static setBucket(_b){
        bucket = _b;
    }

    static async getApps(){
        if(!appsInRam) appsInRam = (await bucket.get('apps')).value;
        return appsInRam;
    }

    static async watchApps(){
        clearInterval(appsInterval);
        return new Promise(async resolve => {

            const setApps = async () => {
                if(!bucket) return;

                const apps = await AppService.getAll();
                if(apps) {
                    await bucket.upsert('apps', apps);
                    appsInRam = apps;
                }

                resolve(true);
            };

            await setApps();
            appsInterval = setInterval(async () => {
                await setApps();
            }, intervalTime);
        })
    }

    static getAll(){
        return Promise.race([
            new Promise(resolve => setTimeout(() => resolve(false), 2500)),
            fetch(`https://rawgit.com/GetScatter/ScatterApps/master/apps.json?rand=${Math.random() * 10000 + 1}`, {
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
