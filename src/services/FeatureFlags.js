export default class FeatureFlags {

	static bridge(){
		return {
			savings:true,
			exchange:true,
			stabilize:false,
			buy:false,
			ridl:false,
		}
	}

	static embed(){
		return {}
	}

}
