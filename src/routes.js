import { Router } from 'express';
import PriceService from './services/PriceService';
import BackupService from './services/BackupService';

import couchbase from './database/couchbase'
const bucket = couchbase('scatter');
PriceService.setBucket(bucket);
BackupService.setBucket(bucket);

// PriceService.watchPrices();

// BackupService.sendRecoveryCodeToEmail('127.0.0.1', 'hello@backup.com').then(code => {
//   BackupService.getEncryptionTester('127.0.0.1', code);
// })



const getPrices = () => {
  return bucket.get('prices');
};

const routes = Router();

routes.get('/', (req, res) => {
  res.json({ hi:'byte'})
});

routes.get('/prices', async (req, res) => {
  const prices = await getPrices();
  const {EOS, ETH, TRX} = prices.value;
  res.json({ EOS, ETH, TRX });
});

routes.get('/profile', async (req, res) => {

});


export default routes;
