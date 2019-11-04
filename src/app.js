import express from 'express';
import logger from 'morgan';
import bodyParser from 'body-parser';
import routes from './routes';
import cors from 'cors';
import compression from 'compression';
import AnalyticsService from "./services/AnalyticsService";
import Blacklist from "./util/blacklist";

const app = express();
app.disable('x-powered-by');

app.use(compression())
app.use(cors({
	exposedHeaders: ['proof'],
}));
app.use(logger('dev', { skip: () => app.get('env') === 'test' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use ((req, res, next) => {
	AnalyticsService.logActivity(req);
	next();
});

// Routes
app.use('/v1', routes);

// Catch 404 and forward to error handler
app.use((req, res, next) => {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// Error handler
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  res
    .status(err.status || 500)
    .render('error', {
      message: err.message
    });
});

const senderIp = req => req.headers['x-forwarded-for'] || req.connection.remoteAddress;
app.use((req, res, next) => {
	if(Blacklist.get(senderIp(req)) < 20) next();
	else res.send(null);
});

export default app;
