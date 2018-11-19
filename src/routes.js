import { Router } from 'express';
import Blockchains from './util/blockchains';

import PriceService from './services/PriceService';
import AppService from "./services/AppService";
import ExplorerService from "./services/ExplorerService";
import FiatService from "./services/FiatService";
import ProxyService from "./services/ProxyService";
// import BackupService from './services/BackupService';

import couchbase from './database/couchbase'

const bucket = couchbase('scatter');

PriceService.setBucket(bucket);
AppService.setBucket(bucket);
ExplorerService.setBucket(bucket);
FiatService.setBucket(bucket);
ProxyService.setBucket(bucket);
// BackupService.setBucket(bucket);

PriceService.watch();
ExplorerService.watch();
AppService.watch();
FiatService.watch();
ProxyService.watch();


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


const flattenBlockchainObject = apps => {
  return Object.keys(apps).reduce((acc, blockchain) => {
    apps[blockchain].map(app => {
      acc.push(Object.assign(app, {blockchain}));
    });
    return acc;
  }, []);
}

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

routes.get('/profile', async (req, res) => {

});


export default routes;
