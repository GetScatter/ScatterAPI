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