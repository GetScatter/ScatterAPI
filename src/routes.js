import { Router } from 'express';
import Blockchains from './util/blockchains';

import TransactionService, {PAYMENT_ACCOUNTS} from "./services/TransactionService";

import PriceService from './services/PriceService';
import AppService from "./services/AppService";
import ExplorerService from "./services/ExplorerService";
import FiatService from "./services/FiatService";
import ProxyService from "./services/ProxyService";
import AccountService from "./services/AccountService";
import NetworkService from "./services/NetworkService";
import LanguageService from "./services/LanguageService";
// import BackupService from './services/BackupService';

import couchbase from './database/couchbase'

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

const CURRENCIES = ['USD', 'EUR', 'CNY', 'GBP', 'JPY', 'CAD', 'CHF'];

const routes = Router();

routes.get('/', (req, res) => {
  res.json({ hi:'byte'})
});

routes.get('/currencies', (req, res) => {
  res.json(CURRENCIES);
});

routes.get('/prices', async (req, res) => {
  const {v2} = req.query;
  const {EOS, ETH, TRX} = await PriceService.getPrices();

  let result;

  if(v2){
    let conversions = await FiatService.getConversions();
    conversions = CURRENCIES.reduce((acc,tick) => {
        acc[tick] = conversions[tick];
        return acc;
    }, {});

    const convertToMultiCurrency = x => {
      return Object.keys(conversions).reduce((acc,fiatTicker) => {
        acc[fiatTicker] = parseFloat(x.price * conversions[fiatTicker]).toFixed(2);
        return acc;
      }, {});
    };

    result = {
      'eos:eosio.token:eos':convertToMultiCurrency(EOS),
      'eth:eth:eth':convertToMultiCurrency(ETH),
      'trx:trx:trx':convertToMultiCurrency(TRX),
    };

  } else {
    result = { EOS, ETH, TRX };
  }

  res.json(result);
});

routes.get('/explorers', async (req, res) => {
  const {flat} = req.query;
  let apps = await ExplorerService.getApps();
  if(flat) apps = flattenBlockchainObject(apps);
  res.json(apps);
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
  let apps = await NetworkService.getNetworks();
  if(flat) apps = flattenBlockchainObject(apps);
  res.json(apps);
});

routes.get('/apps', async (req, res) => {
  const {flat} = req.query;
  let apps = await AppService.getApps();
  if(flat) apps = flattenBlockchainObject(apps);
  res.json(apps);
});

routes.post('/apps', async (req, res) => {
  const {apps} = req.body;
  let allApps = await AppService.getApps();
  if(!apps || !apps.length) return res.json(allApps);
  const result = flattenBlockchainObject(allApps).filter(x => apps.includes(x.applink));
  res.json(result)
});

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


export default routes;
