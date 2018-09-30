import { Router } from 'express';
import PriceService from './services/PriceService';

import couchbase from './database/couchbase'
const bucket = couchbase('scatter');
PriceService.setBucket(bucket);

PriceService.watchPrices();



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


export default routes;
