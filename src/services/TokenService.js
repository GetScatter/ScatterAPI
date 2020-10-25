import "isomorphic-fetch"
import {flattenBlockchainObject} from "../util/blockchains";
import FeaturedApp from "../models/FeaturedApp";
import ReflinkService from "./ReflinkService";

// Once every 30 minutes.
const intervalTime = 60000 * 30;
let interval;
let bucket;
const bucketKey = 'tokenmeta';
const url = 'https://raw.githubusercontent.com/eoscafe/eos-airdrops/master/tokens.json';

const chainIds = {
	'eos':'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
};

// Saving last prices in RAM, to alleviate DB calls.
// Mimics eventually persistent behavior.
let inRam;

export default class TokenService {

    static setBucket(_b){
        bucket = _b;
    }

    static async getTokens(){
	    if(!inRam) inRam = (await bucket.get(bucketKey).catch(() => ({content:[]}))).content;
        return inRam;
    }


    static async watch(){
        clearInterval(interval);
        return new Promise(async resolve => {
	        await this.getTokens();

            const set = async () => {
                if(!bucket) return;

                const tokens = await TokenService.getAll();
                if(tokens) {
                	const tokenMetas = tokens
		                // Mainnet only for now
		                .filter(x => x.chain === 'eos')
		                .reduce((acc,token) => {
		                	const unique = `eos:${token.account}:${token.symbol.toLowerCase()}:${chainIds[token.chain]}`;
		                	acc[unique] = token.logo;
		                	return acc;
		                }, {});


                    await bucket.upsert(bucketKey, tokenMetas);
                    inRam = tokenMetas;
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
