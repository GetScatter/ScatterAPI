const BLACKLIST = {};
export default class Blacklist {

	static add(ip){
		if(!BLACKLIST.hasOwnProperty(ip)) BLACKLIST[ip] = 0;
		BLACKLIST[ip]++;
	}

	static get(ip){
		return BLACKLIST[ip] || 0;
	}

}
