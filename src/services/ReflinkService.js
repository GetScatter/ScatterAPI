import "isomorphic-fetch"
import config from '../util/config'
import REFLINKS from '../../reflinks';

export default class ReflinkService {

	static withRefLink(url, appkey){
		if(REFLINKS && REFLINKS.hasOwnProperty(appkey)){
			return url + REFLINKS[appkey];
		} else return url;
	}

}
