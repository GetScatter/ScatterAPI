import "isomorphic-fetch"
import config from '../util/config'

// Once every 12 hours.
const intervalTime = 60000 * 60 * 12;
let interval;
let bucket;
const bucketKey = 'proxies';
const url = 'https://raw.githubusercontent.com/GetScatter/ScatterProxies/master/proxies.json';


// Saving last prices in RAM, to alleviate DB calls.
// Mimics eventually persistent behavior.
let inRam;

export default class ProxyService {

    static setBucket(_b){
        bucket = _b;
    }

    static async getProxies(){
        if(!inRam) inRam = (await bucket.get(bucketKey)).value;
        return inRam;
    }

    static async watch(){
        clearInterval(interval);
        return new Promise(async resolve => {

            const set = async () => {
                if(!bucket) return;

                const proxies = await ProxyService.getAll();
                if(!proxies) return resolve(true);

	            const alohaProxies = await ProxyService.getFromAloha();
                if(alohaProxies.length){
	                proxies.EOSIO = proxies.EOSIO.concat(alohaProxies).reduce((acc,x) => {
		                if(!acc.find(y => y.account === x.account)) acc.push(x);
		                return acc;
	                }, []);
                }

	            await bucket.upsert(bucketKey, proxies);
	            inRam = proxies;

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
            new Promise(resolve => setTimeout(() => resolve(null), 10000)),
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

    static getFromAloha(){
	    return Promise.race([
		    new Promise(resolve => setTimeout(() => resolve([]), 10000)),
		    fetch('https://www.alohaeos.com/vote/proxy?output=json&show=registered'+`?rand=${Math.random() * 10000 + 1}`, {
			    json: true,
			    gzip: true
		    }).then(x => x.json()).then(res => {
                const sorted = res.proxies.filter(x => x.account && x.philosophy).sort((a,b) => a.rank - b.rank).slice(0, 25);
                return sorted.map(x => ({
                    name:x.name,
                    account:x.account,
                    description:x.philosophy.substr(0,250)
                }));
		    }).catch(err => {
			    console.error(err);
			    return [];
		    })
	    ])
    }

}
