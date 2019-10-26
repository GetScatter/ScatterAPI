import "isomorphic-fetch"
import * as numeric from "eosjs/dist/eosjs-numeric";
import { Api, JsonRpc, RpcError, JsSignatureProvider } from 'eosjs';


const fetchPostParams = (params) => ({ method:"POST", body:JSON.stringify(params) })
const fullhost = (network) => `${network.protocol}://${network.host}${network.port ? ':' : ''}${network.port}${network.path ? network.path : ''}`;
const getChainData = (network, route, params) => fetch(`${fullhost(network)}/v1/chain/${route}`, fetchPostParams(params)).then(x => x.json());


const TextEncoder = require('util').TextEncoder;
const TextDecoder = require('util').TextDecoder;
const encoderOptions = TextEncoder ? {textEncoder:new TextEncoder(), textDecoder:new TextDecoder()} : {};

const getEosjsApi = rpc => {
	let params = rpc ? {rpc} : {};
	if(TextEncoder) params = Object.assign(params, encoderOptions)

	return new Api(params)
}

export const eosjsUtil = getEosjsApi();

export default class WalletPackHelpers {

	static async getContract(network, accounts){
		return Promise.all(accounts.map(async account => {
			const chainAbi = await getChainData(network, `get_raw_abi`, {account_name:account}).catch(() => null).then(x => x.abi);
			if(!chainAbi) return console.error(`Could not fetch ABIs for ${account}`);
			const rawAbi = numeric.base64ToBinary(chainAbi);
			const abi = eosjsUtil.rawAbiToJson(rawAbi);
			return { account, rawAbi, abi};
		}))
	}

}
