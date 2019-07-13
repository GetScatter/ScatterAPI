import { blockexplorer, pushtx } from 'blockchain.info';

const SELECTED_CHAIN = 0;

const explorer = blockexplorer.usingNetwork(SELECTED_CHAIN);


export default class BitcoinService {

	static async getBalance(address){
		return explorer.getBalance(address);
	}

	static async getUnspent(address){
		return explorer.getUnspentOutputs(address);
	}

	static pushTransaction(signedTransaction){
		console.log('signed', signedTransaction);
		// Blockchain.info uses a very old version of lodash via the request-promise library.
		// This handles some prototype pollution vectors.
		if(signedTransaction.toString().indexOf('constructor') > -1) return null;

		return pushtx.usingNetwork(SELECTED_CHAIN).pushtx(signedTransaction).catch(error => {
			if(error.indexOf('Error #-26: dust')) return 'The amount you are trying to send is too low. Bitcoin considers this "dust".';
			return error;
		});
	}

}