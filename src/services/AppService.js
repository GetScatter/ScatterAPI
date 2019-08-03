import "isomorphic-fetch"
import config from '../util/config'
import app from "../app";
import {flattenBlockchainObject} from "../util/blockchains";
import FeaturedApp from "../models/FeaturedApp";

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

    static getFeatured(){
        // TODO: Hardcoded for now
        return [
	        FeaturedApp.fromJson({
		        applink:'bluebet.one',
		        img:'https://images.unsplash.com/photo-1517232115160-ff93364542dd?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1266&q=80',
		        name:'BlueBet',
		        text:'Poker, Baccarat, Black Jack, Powerball.',
		        colors:{
			        overlays:'#000',
			        text:'#000',
			        button:{
				        color:'#000',
				        background:'#fff',
				        border:'#000'
			        },

		        }
	        }),
	        FeaturedApp.fromJson({
		        applink:'decentium.org',
		        img:'https://images.unsplash.com/photo-1484914440268-8d352fe4db95?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1350&q=80',
		        name:'Decentium',
		        text:'Decentium is a decentralized publishing and tipping platform where authors own their content and earn money and exposure through endorsements.',
		        colors:{
			        overlays:'#fff',
			        text:'#fff',
			        button:{
				        color:'#fff',
				        background:'transparent',
				        border:'#fff'
			        },

		        }
	        })
        ]
    }

}
