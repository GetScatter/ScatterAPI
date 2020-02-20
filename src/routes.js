import { Router } from 'express';
import crypto from 'crypto';
import Blockchains, {flattenBlockchainObject} from './util/blockchains';

import PriceService, {PRICE_NETS, CURRENCIES} from './services/PriceService';
import AppService from "./services/AppService";
import VersionService from "./services/VersionService";
import ExplorerService from "./services/ExplorerService";
import FiatService from "./services/FiatService";
import ProxyService from "./services/ProxyService";
import NetworkService from "./services/NetworkService";
import LanguageService from "./services/LanguageService";
import StatusService from "./services/StatusService";
import FeeService from "./services/FeeService";
import TokenService from "./services/TokenService";
// import BackupService from './services/BackupService';
import ExchangeService, {STABLETOKENS,BASETOKENS} from "./services/ExchangeService";

import couchbase from './database/couchbase'
import {dateId} from "./util/dates";
import ReflinkService from "./services/ReflinkService";
import config from "./util/config";
import * as ecc from "eosjs-ecc";
import BitcoinService from "./services/BitcoinService";
import WalletPackHelpers from "./services/WalletPackHelpers";
import Blacklist from "./util/blacklist";
import WebHookService from "./services/WebHookService";
import FeatureFlags from "./services/FeatureFlags";

const bucket = couchbase('scatter');


/********************************/
/*           BUCKETS            */
/********************************/
PriceService.setBucket(bucket);
AppService.setBucket(bucket);
VersionService.setBucket(bucket);
ExplorerService.setBucket(bucket);
FiatService.setBucket(bucket);
ProxyService.setBucket(bucket);
NetworkService.setBucket(bucket);
LanguageService.setBucket(bucket);
FeeService.setBucket(bucket);
TokenService.setBucket(bucket);
WebHookService.setBucket(bucket);
// BackupService.setBucket(bucket);



/********************************/
/*          WATCHERS            */
/********************************/
PriceService.watch();
VersionService.watch();
ExplorerService.watch();
AppService.watch();
FiatService.watch();
ProxyService.watch();
NetworkService.watch();
LanguageService.watch();
StatusService.watch();
FeeService.watch();
TokenService.watch();




const routes = Router();

const senderIp = req => req.headers['x-forwarded-for'] || req.connection.remoteAddress;

const proofKey = config('PROOF_KEY');
const returnResult = (data, req, res) => {
	let {proof} = req.headers;
	if(proof && proof.length === 64){
		proof = ecc.sign(proof, proofKey);
		res.append('proof', proof);
	}
	res.json(data);
};


/************************************************/
/*                                              */
/*             PRICES AND EXCHANGE              */
/*                                              */
/************************************************/
routes.get('/fees', (req, res) => returnResult(FeeService.getFees(), req, res));
routes.get('/currencies', (req, res) => returnResult(CURRENCIES, req, res));
routes.get('/currencies/prices', async (req, res) => {
	let prices = await FiatService.getConversions();
	if(!prices) return returnResult(null, req, res);
	prices = CURRENCIES.reduce((acc,symbol) => {
		acc[symbol] = prices[symbol];
		return acc;
	}, {});
	returnResult(prices, req, res);
});

routes.get('/prices', async (req, res) => {
	const {v2} = req.query;
	returnResult(await PriceService.getV2Prices(v2), req, res)
});

routes.post('/prices', async (req, res) => {
	const {uniques} = req.body;
	returnResult(await PriceService.getV3Prices(uniques), req, res)
});

routes.get('/prices/timeline', async (req, res) => {
	const date = req.query.date ? req.query.date : dateId();
	returnResult(await PriceService.getPriceTimeline(date), req, res);
});

routes.get('/prices/:blockchain/:chainId', async (req, res) => {
	returnResult(false, req, res);
});

routes.get('/exchange/available', async (req, res) => {
	returnResult(ExchangeService.exchangeable(), req, res);
});

routes.post('/exchange/pairs', async (req, res) => {
	const {token, other} = req.body;
	const ip = senderIp(req);
	const exchange = new ExchangeService(ip);
	returnResult(await exchange.pairs(token, other), req, res);
});

routes.post('/exchange/rate', async (req, res) => {
	const {token, other, service} = req.body;
	const ip = senderIp(req);
	const exchange = new ExchangeService(ip);
	returnResult(await exchange.rate(token,other,service), req, res);
});

routes.post('/exchange/order', async (req, res) => {
	const {service, token, other, amount, from, to, returnsErrors = false} = req.body;
	const ip = senderIp(req);
	const exchange = new ExchangeService(ip);
	returnResult(await exchange.createOrder(service, token, other, amount, from, to, returnsErrors), req, res);
});

routes.get('/exchange/order/:order', async (req, res) => {
	const order = req.params.order;
	if(!order) return returnResult(null, req, res);

	const ip = senderIp(req);
	const exchange = new ExchangeService(ip);
	returnResult(await exchange.getOrder(order), req, res);
})

routes.get('/exchange/cancelled/:order', async (req, res) => {
	const order = req.params.order;
	if(!order) return returnResult(null, req, res);
	returnResult(await ExchangeService.cancelled(order), req, res);
})

routes.get('/exchange/accepted/:order', async (req, res) => {
	const order = req.params.order;
	if(!order) return returnResult(null, req, res);
	returnResult(await ExchangeService.accepted(order), req, res);
})

routes.get('/exchange/stabilize/paths', async (req, res) => {
	const unique = t => `${t.blockchain}:${t.contract}:${t.symbol}:${t.chainId}`.toLowerCase();
	returnResult({
		'from':BASETOKENS.concat(STABLETOKENS).map(unique),
		'to':STABLETOKENS
	}, req, res);
});

routes.get('/exchange/pairable', async (req, res) => {
	const ip = senderIp(req);
	const exchange = new ExchangeService(ip);
	returnResult(await exchange.pairable(), req, res);
});



/************************************************/
/*                                              */
/*                  DATA CACHES                 */
/*                                              */
/************************************************/

routes.get('/statuses', async (req, res) => {
	returnResult(StatusService.getStatuses(), req, res);
});

routes.get('/version', async (req, res) => {
	returnResult(await VersionService.getVersion(), req, res);
});

routes.get('/explorers', async (req, res) => {
	const {flat} = req.query;
	let explorers = await ExplorerService.getApps();
	if(flat) explorers = flattenBlockchainObject(explorers);
	returnResult(explorers, req, res);
});

routes.get('/proxies', async (req, res) => {
	const {flat} = req.query;
	let proxies = await ProxyService.getProxies();
	if(flat) proxies = flattenBlockchainObject(proxies);
	returnResult(proxies, req, res);
});

routes.get('/tokenmeta', async (req, res) => {
	returnResult(await TokenService.getTokens(), req, res);
});

routes.get('/languages', async (req, res) => {
	const {names, name} = req.query;
	returnResult(await LanguageService.getLanguages(!!names, name), req, res);
});

routes.get('/networks', async (req, res) => {
	const {flat} = req.query;
	let networks = await NetworkService.getNetworks();
	if(flat) networks = flattenBlockchainObject(networks);
	returnResult(networks, req, res);
});

routes.get('/apps', async (req, res) => {
	const {flat} = req.query;
	returnResult(flat ? await AppService.getFlatApps() : AppService.getApps(), req, res);
});

routes.get('/apps/featured', async (req, res) => {
	returnResult(await AppService.getFeaturedApps(), req, res);
});

routes.post('/apps', async (req, res) => {
	const {apps} = req.body;
	let allApps = await AppService.getFlatApps();
	if(!apps || !apps.length) return returnResult(allApps, req, res);
	const result = allApps.filter(x => apps.includes(x.applink));
	returnResult(result, req, res);
});

routes.get('/app/:applink', async (req, res) => {
	const {applink} = req.params;
	returnResult(await AppService.findApp(applink), req, res);
});


/************************************************/
/*                                              */
/*                 MOBILE HELPERS               */
/*                                              */
/************************************************/


routes.post('/walletpack/abis', async (req, res) => {
	const {network, accounts} = req.body;
	returnResult(await WalletPackHelpers.getContract(network, accounts), req, res);
});




/************************************************/
/*                                              */
/*                 EOS ACCOUNTS                 */
/*                                              */
/************************************************/




/************************************************/
/*                                              */
/*              BITCOIN HELPERS                 */
/*                                              */
/************************************************/


routes.get('/btc/balance/:address', async (req, res) => {
	const address = req.params.address;
	returnResult(await BitcoinService.getBalance(address), req, res);
});

routes.get('/btc/unspent/:address', async (req, res) => {
	const address = req.params.address;
	returnResult(await BitcoinService.getUnspent(address), req, res);
});

routes.post('/btc/pushtx', async (req, res) => {
	const signed = req.body.signed;
	returnResult(await BitcoinService.pushTransaction(signed), req, res);
});



/************************************************/
/*                                              */
/*              Webhooks                 */
/*                                              */
/************************************************/


routes.get('/hook/remove/:unique', async (req, res) => {
	const {unique} = req.params;
	returnResult(await WebHookService.removeHook(unique), req, res);
});

routes.post('/hook/:service', async (req, res) => {
	const {service} = req.params;
	const payload = req.body;
	WebHookService.setHook(service, payload);
	returnResult(true, req, res);
});

routes.get('/hook/:service/:id', async (req, res) => {
	const {service, id} = req.params;
	returnResult(await WebHookService.findHooks(service, id), req, res);
});

/************************************************/
/*                                              */
/*              FEATURE FLAGS                   */
/*                                              */
/************************************************/


routes.get('/flags/:wallet', async (req, res) => {
	const {wallet} = req.params;
	let flags = {};
	if(typeof FeatureFlags[wallet] === 'function') flags = FeatureFlags[wallet]();
	returnResult(flags, req, res);
});

const URL = require('url').URL;
routes.post('/moonpay/sign', async (req, res) => {
	const {url} = req.body;
	const signature = crypto
		.createHmac('sha256', process.env.MOONPAY_KEY)
		.update(new URL(url).search)
		.digest('base64');
	returnResult(signature, req, res);
});




/************************************************/
/*                                              */
/*                 WEB SOCKETS                  */
/*                                              */
/************************************************/
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: process.env.WS_PORT });

// This is really only used to speed up setup time since many calls
// takes a long time when done in unison due to 3 simultaneous request limitations.
wss.on('connection', (ws) => {
	ws.on('message', async (msg) => {
		try {
			const {route, data, id} = JSON.parse(msg);
			const returnSocket = data => ws.send(JSON.stringify({ data, id, signed:ecc.sign(id, proofKey) }));

			if(route === 'apps/featured') return returnSocket(await AppService.getFeaturedApps());
			if(route === 'apps') {
				let allApps = await AppService.getFlatApps();
				if(!data || !data.length) return returnSocket(allApps);
				const result = allApps.filter(x => data.includes(x.applink));
				return returnSocket(result);
			}
			if(route === 'flags/bridge') return returnSocket(FeatureFlags.bridge());
			if(route === 'prices') return returnSocket(await PriceService.getV3Prices(data));
			if(route === 'tokenmeta') return returnSocket(await TokenService.getTokens());
			if(route === 'currencies/prices') {
				let prices = await FiatService.getConversions();
				if(!prices) return returnSocket(null);
				prices = CURRENCIES.reduce((acc,symbol) => {
					acc[symbol] = prices[symbol];
					return acc;
				}, {});
				return returnSocket(prices);
			}

		} catch(e){ console.error(e); /* rejections just fail */ }
	});
});




routes.all('*', (req, res) => {
	Blacklist.add(senderIp(req));
	res.sendStatus(403);
});

export default routes;
