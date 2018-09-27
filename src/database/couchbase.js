import config from '../util/config';

import { promisifyAll } from 'bluebird';

const couchbase = require('couchbase');

export const n1ql = couchbase.N1qlQuery;

const cluster = new couchbase.Cluster(config('COUCHBASE_HOST'));
cluster.authenticate(config('COUCHBASE_USERNAME'),config('COUCHBASE_PASSWORD'));

export default bucketName => {
    const bucket = cluster.openBucket(bucketName);
    promisifyAll(bucket);

    const bucketAdditions = {
        existsAsync:(key) => {
            return new Promise((resolve, reject) => {
                bucket.getAsync(key)
                    .then(res => resolve(true))
                    .catch(error => {
                        if(error.code === 13) resolve(false);
                        else throw new Error(error);
                    })
            })
        }
    };

    const bucketWithAdditions = Object.assign(bucket, bucketAdditions);

    // Sets up a proxy to turn all methods into async using bluebird
    return new Proxy(bucketWithAdditions, {
        get(b, method){ return (...args) => {
            // Mutations return the MutationBuilder and should not become async.
            if(method.indexOf('mutate') > -1) return bucket[method](...args);
            // Everything else will become async
            else return bucket[`${method}Async`](...args);
        } }
    })
};

