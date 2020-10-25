import "isomorphic-fetch"
import config from '../util/config'

// Once every 12 hours.
const intervalTime = 60000 * 60 * 12;
let interval;
let bucket;
const bucketKey = 'languages';
const url = 'https://raw.githubusercontent.com/GetScatter/DesktopTranslations/master/src/languages.json';

const randString = () => `?rand=${Math.random() * 10000 + 1}`;
const baseUrl = 'https://raw.githubusercontent.com/GetScatter/DesktopTranslations/master/src/';
const languagesUrl = () => `${baseUrl}languages.json`+randString();
const languageJson = (language) => `${baseUrl}languages/${language}.json`+randString();

const fetchJson = url => fetch(url, { json: true, gzip: true }).then(res => res.json());

let inRam;

export default class LanguageService {

    static setBucket(_b){
        bucket = _b;
    }

    static async getLanguages(namesOnly = false, name = null){
        if(!inRam) inRam = (await bucket.get(bucketKey)).content;

        if(namesOnly) return inRam.map(x => x.name);

        if(name) return inRam.find(x => x.name === name);

        return inRam;
    }

    static async watch(){
        clearInterval(interval);
        return new Promise(async resolve => {

            const set = async () => {
                if(!bucket) return;

                const explorers = await LanguageService.getAll();
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
            new Promise(resolve => setTimeout(() => resolve(false), 30000)),
	        fetchJson(languagesUrl())
            .then(async languages => {
                return await Promise.all(languages.map(language => {
                    return fetchJson(languageJson(language))
                }))
            }).catch(err => {
                return null;
            })
        ])
    }

}
