import { Router } from 'express';
import Blockchains from './util/blockchains';

import TransactionService, {PAYMENT_ACCOUNTS} from "./services/TransactionService";

import PriceService, {PRICE_NETS, CURRENCIES} from './services/PriceService';
import AppService from "./services/AppService";
import VersionService from "./services/VersionService";
import ExplorerService from "./services/ExplorerService";
import FiatService from "./services/FiatService";
import ProxyService from "./services/ProxyService";
import AccountService from "./services/AccountService";
import NetworkService from "./services/NetworkService";
import LanguageService from "./services/LanguageService";
import StatusService from "./services/StatusService";
// import BackupService from './services/BackupService';
import ExchangeService, {STABLETOKENS,BASETOKENS} from "./services/ExchangeService";

import couchbase from './database/couchbase'
import {dateId} from "./util/dates";
import ReflinkService from "./services/ReflinkService";
import config from "./util/config";
import * as ecc from "eosjs-ecc";

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
AccountService.setBucket(bucket);
NetworkService.setBucket(bucket);
LanguageService.setBucket(bucket);
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

const flattenBlockchainObject = apps => {
	return Object.keys(apps).reduce((acc, blockchain) => {
		apps[blockchain].map(app => {
			const assigned = app.hasOwnProperty('blockchain') ? app : Object.assign(app, {blockchain});
			acc.push(assigned);
		});
		return acc;
	}, []);
}


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

routes.get('/prices/timeline', async (req, res) => {
	const date = req.query.date ? req.query.date : dateId();
	returnResult(await PriceService.getPriceTimeline(date), req, res);
});

routes.get('/prices/:blockchain/:chainId', async (req, res) => {
	returnResult(false, req, res);
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
	const {service, token, other, amount, from, to} = req.body;
	const ip = senderIp(req);
	const exchange = new ExchangeService(ip);
	returnResult(await exchange.createOrder(service, token, other, amount, from, to), req, res);
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
	let apps = await AppService.getApps();
	if(flat) {
		apps = flattenBlockchainObject(apps);
		apps = apps.map(app => {
			const a = JSON.parse(JSON.stringify(app));
			a.url = ReflinkService.withRefLink(a.url, a.applink);
			return a;
		});
	}

	returnResult(apps, req, res);
});

routes.post('/apps', async (req, res) => {
	const {apps} = req.body;
	let allApps = await AppService.getApps();
	if(!apps || !apps.length) return returnResult(allApps, req, res);
	const result = flattenBlockchainObject(allApps).filter(x => apps.includes(x.applink));
	returnResult(result, req, res);
});






/************************************************/
/*                                              */
/*                 EOS ACCOUNTS                 */
/*                                              */
/************************************************/


routes.post('/create_eos', async (req, res) => {
	const defaultError = {error:'There was an error creating the account. Please try again later.'};
	const {transaction_id, signature, keys, account_name} = req.body;

	if(!keys.hasOwnProperty('active') || !keys.hasOwnProperty('owner') || !keys.active.length || !keys.owner.length){
		return returnResult({error:'Invalid keys'}, req, res);
	}

	const minimumCost = await AccountService.getAccountMinimumCost();
	if(!minimumCost) return returnResult(defaultError, req, res);

	const transactionStatus = await TransactionService.eos(transaction_id, minimumCost, PAYMENT_ACCOUNTS.EOS.NEW_ACCOUNT);
	if(!transactionStatus || transactionStatus.hasOwnProperty('error')) return returnResult(transactionStatus.hasOwnProperty('error')
		? {error:transactionStatus.error}
		: {error:'The transaction could not be verified.'}, req, res);


	const [quantity, memo] = transactionStatus;

	const leftForResources = parseFloat(quantity - minimumCost).toFixed(4);
	if(!leftForResources || leftForResources <= 0) return returnResult({error:'There was not enough EOS left for resources.'}, req, res);

	if(memo !== keys.active) return returnResult({error:'The signature for account creation did not match the key from the exchange memo'}, req, res);

	const created = await AccountService.createEosAccount(account_name, keys, leftForResources, transaction_id, signature);
	if(!created) return returnResult(defaultError, req, res);

	returnResult({created}, req, res);
});

routes.post('/create_bridge', async (req, res) => {
	const defaultError = {error:'There was an error creating the account. Please try again later.'};
	const {signature, key, name, machineId, free} = req.body;
	const ip = senderIp(req);

	if(!key || !key.length) return returnResult({error:'Invalid Key'}, req, res);

	if(free){
		if(machineId.length !== 64) return returnResult({error:'Bad Machine ID.'}, req, res);
		if(await AccountService.checkMachineId(machineId)) return returnResult({error:'One free account per user.'}, req, res);
		if(await AccountService.checkIp(ip)) return returnResult({error:'One free account per user.'}, req, res);
		if(!await AccountService.proveSignature(signature, key, AccountService.sha256(key+machineId+name))) return returnResult({error:'Signature does not match key.'}, req, res);

		const created = await AccountService.createBridgeAccount(name, key, true);
		if(created && !created.hasOwnProperty('error')) await AccountService.logCreation(ip, machineId);
		returnResult(created, req, res);
	} else {
		const canCreate = await AccountService.canCreateBridge(key, signature);
		if(canCreate !== true) return returnResult(canCreate, req, res);

		const created = await AccountService.createBridgeAccount(name, key);
		return returnResult(created, req, res);
	}
});

routes.get('/machine/:id', async (req, res) => {
	const {id} = req.params;
	const ip = senderIp(req);
	if(await AccountService.checkMachineId(id)) return returnResult(false, req, res);
	if(await AccountService.checkIp(ip)) return returnResult(false, req, res);
	returnResult(true, req, res);
});



routes.all('*', (req, res) => res.sendStatus(403));

export default routes;
