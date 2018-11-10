import { Router } from 'express';
import PriceService from './services/PriceService';
import AppService from "./services/AppService";
// import BackupService from './services/BackupService';

import couchbase from './database/couchbase'
const bucket = couchbase('scatter');
PriceService.setBucket(bucket);
AppService.setBucket(bucket);
// BackupService.setBucket(bucket);

PriceService.watchPrices();
AppService.watchApps();



const routes = Router();

routes.get('/', (req, res) => {
  res.json({ hi:'byte'})
});

routes.get('/prices', async (req, res) => {
  const {EOS, ETH, TRX} = await PriceService.getPrices();
  res.json({ EOS, ETH, TRX });
});


const flattenApps = apps => {
  return Object.keys(apps).reduce((acc, blockchain) => {
    apps[blockchain].map(app => {
      acc.push(Object.assign(app, {blockchain}));
    });
    return acc;
  }, []);
}

routes.get('/apps', async (req, res) => {
  const {flat} = req.query;
  let apps = await AppService.getApps();
  if(flat) apps = flattenApps(apps);
  res.json(apps);
});

routes.post('/apps', async (req, res) => {
  const {apps} = req.body;
  let allApps = await AppService.getApps();
  if(!apps || !apps.length) return res.json(allApps);
  const result = flattenApps(allApps).filter(x => apps.includes(x.applink));
  res.json(result)

});

routes.get('/profile', async (req, res) => {

});


export default routes;
