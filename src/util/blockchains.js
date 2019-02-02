const BLOCKCHAINS = {
	EOSIO:'EOSIO',
	ETH:'Ethereum',
	TRX:'Tron'
}

export default BLOCKCHAINS;

export const convertBlockchain = b => {
	switch(b){
		case BLOCKCHAINS.EOSIO: return 'eos';
		case BLOCKCHAINS.ETH: return 'eth';
		case BLOCKCHAINS.TRX: return 'trx';
	}
}

export const flattenBlockchainObject = apps => {
	return Object.keys(apps).reduce((acc, blockchain) => {
		apps[blockchain].map(app => {
			const assigned = app.hasOwnProperty('blockchain') ? app : Object.assign(app, {blockchain});
			acc.push(assigned);
		});
		return acc;
	}, []);
}