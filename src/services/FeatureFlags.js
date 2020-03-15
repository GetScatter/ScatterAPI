import config from "../util/config";

const FEATURES = (config('FEATURES') || "").split(',');

// return {
// 	savings:true,
// 	exchange:true,
// 	stabilize:false,
// 	buy:false,
// 	ridl:false,
// }
const getFeatures = () => {
	let features = {};
	FEATURES.map(feature => {
		features[feature] = true;
	});
	return features;
}

export default class FeatureFlags {

	static bridge(){
		return getFeatures();
	}

	static embed(){
		return getFeatures();
	}

}
