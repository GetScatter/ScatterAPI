import config from '../util/config';

const couchbase = require('couchbase');


const cluster = new couchbase.Cluster(config('COUCHBASE_HOST'), {
	username: config('COUCHBASE_USERNAME'),
	password: config('COUCHBASE_PASSWORD'),
});

let instances = {};

const query = (queryString, model = null) => {
	// Replaces placeholder param.
	queryString = queryString.replace(/BUCKET_NAME/g, '`'+BUCKET_NAME+'`');

	return cluster.query(queryString, {
		scanConsistency: couchbase.QueryScanConsistency.RequestPlus
	}).then(({meta, rows}) => {
		if(!rows) return [];
		// Fix for couchbase stupidness
		rows = rows.map(x => x[BUCKET_NAME] ? x[BUCKET_NAME] : x);
		rows = rows.map(x => x.data);

		return rows.map(x => {
			if(model) return model.fromJson(x);
			return x;
		})
	}).catch(err => {
		console.error(err);
		return null
	});
}

const get = (bucket_name) => {
	if(instances[bucket_name]) return instances[bucket_name];

	instances[bucket_name] = cluster.bucket(bucket_name).defaultCollection();
	return instances[bucket_name];
};

export default {
	query,
	get,
};











