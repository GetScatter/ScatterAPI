import ecc from 'eosjs-ecc';
import ua from 'universal-analytics'
import 'isomorphic-fetch';
import config from "../util/config";


const senderIp = req => req.headers['x-forwarded-for'] || req.connection.remoteAddress;
const TRACKING_ID = config('GA_TRACKING_ID');

/***
 * No data in the analytics should ever contain any reference to
 * paired user data. IPs are never related to any specific accounts.
 * IP forwarding is only being used for location-based analytics so we
 * can provide better localization support for high-pressure countries.
 */
export default class AnalyticsService {

	static async logActivity(req){
		const uip = senderIp(req);
		console.log('uip', uip);
		const hashedIp = ecc.sha256(uip);
		const visitor = ua(TRACKING_ID, hashedIp, {strictCidFormat: false});
		visitor.set("uip", uip);
		visitor.pageview(req.url).event("Api", req.url).send()
	}

}