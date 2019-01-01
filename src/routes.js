import { Router } from 'express';
import Blockchains from './util/blockchains';

import TransactionService, {PAYMENT_ACCOUNTS} from "./services/TransactionService";

import PriceService, {PRICE_NETS, CURRENCIES} from './services/PriceService';
import AppService from "./services/AppService";
import ExplorerService from "./services/ExplorerService";
import FiatService from "./services/FiatService";
import ProxyService from "./services/ProxyService";
import AccountService from "./services/AccountService";
import NetworkService from "./services/NetworkService";
import LanguageService from "./services/LanguageService";
// import BackupService from './services/BackupService';
import ExchangeService from "./services/ExchangeService";

import couchbase from './database/couchbase'
import {dateId} from "./util/dates";
import ReflinkService from "./services/ReflinkService";

const bucket = couchbase('scatter');


/********************************/
/*           BUCKETS            */
/********************************/
PriceService.setBucket(bucket);
AppService.setBucket(bucket);
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
ExplorerService.watch();
AppService.watch();
FiatService.watch();
ProxyService.watch();
NetworkService.watch();
LanguageService.watch();

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



/************************************************/
/*                                              */
/*             PRICES AND EXCHANGE              */
/*                                              */
/************************************************/

routes.get('/currencies', (req, res) => res.json(CURRENCIES));
routes.get('/currencies/prices', async (req, res) => {
	let prices = await FiatService.getConversions();
	if(!prices) return res.json(null);
	prices = CURRENCIES.reduce((acc,symbol) => {
		acc[symbol] = prices[symbol];
		return acc;
	}, {});
	res.json(prices)
});

routes.get('/prices', async (req, res) => {
	const {v2} = req.query;
	res.json(await PriceService.getV2Prices(v2));
});

routes.get('/prices/timeline', async (req, res) => {
	const date = req.query.date ? req.query.date : dateId();
	res.json(await PriceService.getPriceTimeline(date));
});

routes.get('/prices/:blockchain/:chainId', async (req, res) => {

	res.json(false);
});

routes.post('/exchange/pairs', async (req, res) => {
	const {token, other} = req.body;
	const ip = senderIp(req);
	const exchange = new ExchangeService(ip);
	const pairs = await exchange.pairs(token, other);
	res.json(pairs);
});

routes.post('/exchange/rate', async (req, res) => {
	const {token, other, service} = req.body;
	const ip = senderIp(req);
	const exchange = new ExchangeService(ip);
	const rates = await exchange.rate(token,other,service);
	res.json(rates);
});

routes.post('/exchange/order', async (req, res) => {
	const {service, token, other, amount, from, to} = req.body;
	const ip = senderIp(req);
	const exchange = new ExchangeService(ip);
	const order = await exchange.createOrder(service, token, other, amount, from, to);

	res.json(order);
});

routes.get('/exchange/order/:order', async (req, res) => {
	const order = req.params.order;
	if(!order) return res.json(null);

	const ip = senderIp(req);
	const exchange = new ExchangeService(ip);
	res.json(await exchange.getOrder(order));
})

routes.get('/exchange/cancelled/:order', async (req, res) => {
	const order = req.params.order;
	if(!order) return res.json(null);
	res.json(await ExchangeService.cancelled(order));
})

routes.get('/exchange/accepted/:order', async (req, res) => {
	const order = req.params.order;
	if(!order) return res.json(null);
	res.json(await ExchangeService.accepted(order));
})



/************************************************/
/*                                              */
/*                  DATA CACHES                 */
/*                                              */
/************************************************/

routes.get('/explorers', async (req, res) => {
	const {flat} = req.query;
	let explorers = await ExplorerService.getApps();
	if(flat) explorers = flattenBlockchainObject(explorers);
	res.json(explorers);
});

routes.get('/proxies', async (req, res) => {
	const {flat} = req.query;
	let proxies = await ProxyService.getProxies();
	if(flat) proxies = flattenBlockchainObject(proxies);
	res.json(proxies);
});

routes.get('/languages', async (req, res) => {
	const {names, name} = req.query;
	res.json(await LanguageService.getLanguages(!!names, name));
});

routes.get('/networks', async (req, res) => {
	const {flat} = req.query;
	let networks = await NetworkService.getNetworks();
	if(flat) networks = flattenBlockchainObject(networks);
	res.json(networks);
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

	res.json(apps);
});

routes.post('/apps', async (req, res) => {
	const {apps} = req.body;
	let allApps = await AppService.getApps();
	if(!apps || !apps.length) return res.json(allApps);
	const result = flattenBlockchainObject(allApps).filter(x => apps.includes(x.applink));
	res.json(result)
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
		return res.json({error:'Invalid keys'});
	}

	const minimumCost = await AccountService.getAccountMinimumCost();
	if(!minimumCost) return res.json(defaultError);

	const transactionStatus = await TransactionService.eos(transaction_id, minimumCost, PAYMENT_ACCOUNTS.EOS.NEW_ACCOUNT);
	if(!transactionStatus || transactionStatus.hasOwnProperty('error')) return res.json(
		transactionStatus.hasOwnProperty('error')
			? {error:transactionStatus.error}
			: {error:'The transaction could not be verified.'}
	);

	const [quantity, memo] = transactionStatus;

	const leftForResources = parseFloat(quantity - minimumCost).toFixed(4);
	if(!leftForResources || leftForResources <= 0) return res.json({error:'There was not enough EOS left for resources.'});

	if(memo !== keys.active) return res.json({error:'The signature for account creation did not match the key from the exchange memo'});

	const created = await AccountService.createEosAccount(account_name, keys, leftForResources, transaction_id, signature);
	if(!created) return res.json(defaultError);

	res.json({created});
});

routes.post('/create_bridge', async (req, res) => {
	const defaultError = {error:'There was an error creating the account. Please try again later.'};
	const {signature, key, name, machineId, free} = req.body;
	const ip = senderIp(req);

	if(!key || !key.length) return res.json({error:'Invalid Key'});

	if(free){
		if(machineId.length !== 64) return res.json({error:'Bad Machine ID.'});
		if(await AccountService.checkMachineId(machineId)) return res.json({error:'One free account per user.'});
		if(await AccountService.checkIp(ip)) return res.json({error:'One free account per user.'});
		if(!await AccountService.proveSignature(signature, key, AccountService.sha256(key+machineId+name))) return res.json({error:'Signature does not match key.'});

		const created = await AccountService.createBridgeAccount(name, key, true);
		if(created && !created.hasOwnProperty('error')) await AccountService.logCreation(ip, machineId);
		return res.json(created);
	} else {
		const canCreate = await AccountService.canCreateBridge(key, signature);
		if(canCreate !== true) return res.json(canCreate);

		const created = await AccountService.createBridgeAccount(name, key);
		return res.json(created);
	}
});

routes.get('/machine/:id', async (req, res) => {
	const {id} = req.params;
	const ip = senderIp(req);
	if(await AccountService.checkMachineId(id)) return res.json(false);
	if(await AccountService.checkIp(ip)) return res.json(false);
	res.json(true);
});



routes.all('*', (req, res) => res.sendStatus(403));

export default routes;
