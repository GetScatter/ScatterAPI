import "isomorphic-fetch"
import config from '../util/config'
import app from "../app";
import {flattenBlockchainObject} from "../util/blockchains";
import FeaturedApp from "../models/FeaturedApp";
import ReflinkService from "./ReflinkService";

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

    static async getFlatApps(){
	    let apps = await AppService.getApps();
	    apps = flattenBlockchainObject(apps);
	    return apps.map(app => {
		    const a = JSON.parse(JSON.stringify(app));
		    a.url = ReflinkService.withRefLink(a.url, a.applink);
		    return a;
	    });
    }

    static async findApp(origin){
	    const emptyResult = {
		    applink:origin,
		    type:'',
		    name:origin,
		    description:'',
		    logo:'',
		    url:'',
	    };

	    const dappData = await AppService.getFlatApps().then(res => res.reduce((acc,x) => {
            acc[x.applink] = x;
            return acc;
	    }, {}));
	    let found = dappData[origin];

	    if(!found){
		    (() => {
			    // Checking subdomains
			    if(origin.split('.').length < 2) return;
			    const [subdomain, domain, suffix] = origin.split('.');
			    Object.keys(dappData).map(applink => {
				    if(origin.indexOf(applink) === -1) return;
				    const dapp = dappData[applink];
				    if(!dapp.hasOwnProperty('subdomains') || !dapp.subdomains.length) return;
				    // Checking wildcards
				    if(dapp.subdomains.find(x => x === '*')){
					    if(`*.${applink}` === `*.${domain}.${suffix}`) return found = dapp;
				    }
				    // Checking hardcoded domains
				    else {
					    dapp.subdomains.map(sub => {
						    if(`${sub}.${applink}` === origin) return found = dapp;
					    })
				    }
			    })
		    })();
	    }

	    if(!found) return emptyResult;

	    const maxDescriptionLength = 70;
	    if(found.description.length > maxDescriptionLength){
		    found.description = `${found.description.substr(0,70)}${found.description.length > 70 ? '...':''}`
	    }

	    return found;
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
			        overlays:'yellow',
			        text:'yellow',
			        button:{
				        color:'yellow',
				        background:'transparent',
				        border:'1px solid yellow'
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
				        border:'1px solid #fff'
			        },

		        }
	        })
        ]
    }

    static async getFeaturedApps(){
    	return await Promise.all([
		    {
			    applink:'earnbet.io',
			    img:'https://get-scatter.com/promos/eosbet.io.jpg',
			    url:'https://earnbet.io/?ref=scatterrefer&utm_campaign=eos%20bet%20standard',
		    },
		    {
			    applink:'dappspinach.io',
			    img:'https://get-scatter.com/promos/dappspinach.io.jpg',
			    url:'https://dappspinach.io/dapp/pc/dist/?channel=scat&utm_campaign=spinach+standard',
		    },
		    {
			    applink:'mycryptovegas.io',
			    img:'https://get-scatter.com/promos/mycryptovegas.jpg',
			    url:'https://mycryptovegas.io/?ref=354625577968&utm_campaign=crypto+vegas+slot+wars',
		    },
		    {
			    applink:'hirevibes.io',
			    img:'https://get-scatter.com/promos/hirevibes.jpg',
			    url:'https://www.hirevibes.io/?utm_campaign=hirevibes+standard',
		    },
		    {
			    applink:'prospectors.io',
			    img:'https://get-scatter.com/promos/prospectors.jpg',
			    url:'https://prospectors.io?ref=scatterrefer&utm_campaign=prospectors+standard',
		    },
		    {
			    applink:'bethash.io',
			    img:'https://get-scatter.com/promos/bethash.jpg',
			    url:'https://bethash.io/?ref=scatterrefer&utm_campaign=bethash+standard',
		    },
		    {
			    applink:'trustdice.win',
			    img:'https://get-scatter.com/promos/trustdice.win.jpg',
			    url:'https://trustdice.win/faucet?coinbox&ref=scatterrefer&utm_campaign=trustdice+standard',
		    },
		    {
			    applink:'dice.one',
			    img:'https://get-scatter.com/promos/dice.one.jpg',
			    url:'https://dice.one/?ref=scatterrefer&utm_campaign=dice+standard',
		    }
	    ].map(async x => {
		    let meta = await AppService.findApp(x.applink);
		    if(meta){
			    meta = Object.assign(meta, x);
		    } else meta = x;

		    return FeaturedApp.fromJson(meta);
	    }))
    }

}
