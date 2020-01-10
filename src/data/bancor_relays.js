
const eosMainnetId = 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906';
const token = (bancor_id, name, symbol, contract, decimals = 4) => ({
	bancor_id,
	id:`${contract}::${symbol}`.toLowerCase(),
	symbol,
	token:{ blockchain:'eos', chainId:eosMainnetId, contract, symbol, name, decimals },
});

export const BANCOR_EOS_PAIRS = [
	token('5a1eb3753203d200012b8b75', `EOS`, `EOS`, `eosio.token`),
	// token('5c0e3f4464f6f90710095f3c', `eosBLACK`, `BLACK`, `eosblackteam`),
	token('5c0e40c553c03b14b3e30193', `Karma`, `KARMA`, `therealkarma`),
	token('5c0e4c2f53c03b584de35afc', `Prospectors Gold`, `PGL`, `prospectorsg`),
	token('5c0e98aa675bcf4cc346c5da', `Chaince`, `CET`, `eosiochaince`),
	token('5c0e5181c01d8814fa2296f0', `HorusPay`, `HORUS`, `horustokenio`),
	token('5c0e529564f6f94efa0a075d', `Meet.One`, `MEETONE`, `eosiomeetone`),
	token('5c0e640cc01d8846c42327ad', `Prochain`, `EPRA`, `epraofficial`),
	token('5c0e8fdb675bcfda09467194', `BetDice`, `DICE`, `betdicetoken`),
	token('5c0e67d364f6f9d3670aa4c7', `OracleChain`, `OCT`, `octtothemoon`),
	token('5c0e62bb675bcfb491451108', `Everipedia IQ`, `IQ`, `everipediaiq`, 3),
	token('5c0e662c54ed33261ddb853b', `HireVibes`, `HVT`, `hirevibeshvt`),
	// token(`DEOS Games`, `DEOS`, `thedeosgames`),
	token('5c0e698a48ded4568c33eea3', `MyVegas`, `MEV`, `eosvegascoin`),
	token('5c45c33851c75d8823bd7b0f', `Carbon`, `CUSD`, `stablecarbon`),
	token('1', `EOSDT`, `EOSDT`, `eosdtsttoken`),
	// token('2', `Emanate`, `EMT`, `emanateoneos`),
];

export const BANCOR_RELAYS = {
	'EOS':'bnt2eoscnvrt',
	'BLACK':'bancorc11112',
	'KARMA':'bancorc11112',
	'PGL':'bancorc11113',
	'CET':'bancorc11114',
	'HORUS':'bancorc11121',
	'MEETONE':'bancorc11122',
	'EPRA':'bancorc11124',
	'DICE':'bancorc11125',
	'OCT':'bancorc11132',
	'IQ':'bancorc11123',
	'HVT':'bancorc11131',
	'DEOS':'bancorc11115',
	'MEV':'bancorc11134',
	'CUSD':'bancorc11144',
	'EOSDT':'bancorc11222',
	// 'EMT':'bancorc11213',
};

// https://github.com/bancorprotocol/bancor-sdk/blob/master/src/blockchains/eos/paths.ts

/*
	Bancor	BNT	bnt2eosrelay	bnt2eoscnvrt
	eosBLACK	BNTBLK	bancorr11111	bancorc11111
	Karma	BNTKRM	bancorr11112	bancorc11112
	Prospectors Gold	BNTPGL	bancorr11113	bancorc11113
	Chaince	BNTCET	bancorr11114	bancorc11114
	HorusPay	BNTHRUS	bancorr11121	bancorc11121
	Meet.One	BNTMEET	bancorr11122	bancorc11122
	Prochain	BNTEPRA	bancorr11124	bancorc11124
	BetDice	BNTDICE	bancorr11125	bancorc11125
	OracleChain	BNTOCT	bancorr11132	bancorc11132
	Eos Poker	BNTPKR	bancorr11133	bancorc11133 (? this one doesn't exist?)
	Everipedia	BNTIQ	bancorr11123	bancorc11123
	HireVibes	BNTHVT	bancorr11131	bancorc11131
	DEOS Games	BNTDEOS	bancorr11115	bancorc11115
	MyVegas	BNTMEV	bancorr11134	bancorc11134
	Gold TAEL	BNTTAEL	bancorr11145	bancorc11145
	CARBON (CUSD)	BNTCUSD	bancorr11142	bancorc11144
 */
