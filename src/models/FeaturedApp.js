export default class FeaturedApp {
	constructor(){
		this.applink = '';
		this.img = '';
		this.name = '';
		this.url = '';
		this.text = '';
		this.colors = null;
	}

	static placeholder(){ return new FeaturedApp(); }
	static fromJson(json){
		return Object.assign(this.placeholder(), json);
	}
}
