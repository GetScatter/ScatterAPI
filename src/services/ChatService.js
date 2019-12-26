const WebSocket = require('ws');

let webSocketServer;

let last50 = [];

export default class ChatService {

	static init(){
		webSocketServer = new WebSocket.Server({ port: 10585 });
		webSocketServer.on('connection', (webSocket) => {
			webSocket.on('message', data => {
				if(data === 'get_messages') return webSocket.send(JSON.stringify(last50));

				this.onMessage(data);
			});
		});
	}

	static onMessage(data){
		data = JSON.parse(data);
		if(!data.message || !data.user || !data.user.hasOwnProperty('sender')) return null;
		if(data.message.trim().length > 1000 || !data.message.trim().length) return null;
		data.timestamp = +new Date();
		this.broadcast(JSON.stringify(data));

		last50.push(data);
		if(last50.length > 50) last50.shift();
	}

	static broadcast(data){
		webSocketServer.clients.forEach(client => {
			if (client.readyState === WebSocket.OPEN) client.send(data);
		});
	}


}
