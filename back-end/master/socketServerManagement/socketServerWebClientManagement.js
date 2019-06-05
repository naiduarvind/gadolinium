let APIStatusFunc = require('../APIStatus/functions');
let GCPFunc = require('../GoogleCloudManagement/functions');
let socketServerFunc = require('./socketServerCreationAndConnection');
let socketServerSlaveManagement = require('./socketServerSlaveManagement');

let onAPIStatus = (webClient) => {
	webClient.on('APIStatus', (callback) => { //TODO In test
		callback(APIStatus.getAPIStatus());
	});
};

let createNewAPITestRequest = (webClient) => {
	webClient.on('newAPITest', (callback) => { //TODO In test
		callback(APIStatus.getAPIStatus());
	});
};

let onDeleteServer = (webClient, callback) => {
	webClient.on('deleteServer', async (data) => {
		let apiId = data.apiId;
		let serverName = data.serverName;
		let zone = data.zone;
		APIStatusFunc.deleteServer(apiId, serverName);
		socketServerFunc.emitAPIStatusUpdate();
		response.then((response) => {
			if (response.status === 200) {
				callback(true);
			} else if (response.status === 404) {
				callback(false);
			}
		})
	})
};

let createApiDeletion = (webClient, callback) => {
	webClient.on('deleteApi', async (apiId) => {
		APIStatusFunc.deleteApi(apiId);
		socketServerFunc.emitAPIStatusUpdate();
	})
};

let addTestServer = (region, apiId, type) => {

};

let onAddTestServer = (webclient) => {
	webclient.on('addTestServer', (data) => {
		let servers = createServerInstance(data.regions, data.apiId, data.type);
		APIStatusFunc.addServers(data.apiId, servers);
		servers.forEach((server) => {
			socketServerSlaveManagement.addSlaveToBootingSlaveList(server.name, data.apiId);
			socketServerSlaveManagement.addSlaveToTestSlaveList(server.name, data.apiId, data.type);
		});
		socketServerFunc.emitAPIStatusUpdate();
	})
};

let createServerInstance = (serverList, apiId, type) => {
	let gcpServerList = GCPFunc.getListOfZones();
	let servers = [];
	for (let server of serverList) {
		let randomZone = gcpServerList[server].zones[Math.floor(Math.random() * gcpServerList[server].zones.length)];
		let zoneName = `${server}-${randomZone}`;
		let vmName = `api-${apiId}-${zoneName}`;
		servers.push({
			name: vmName,
			type: type,
			region: server,
			zone: zoneName,
			location: gcpServerList[server].location,
			status: "Booting up",
			progress: 1,
			totalProgress: 1
		});
		GCPFunc.createVM(zoneName, vmName);
	}
	return servers;
};

let createSendTestToSlaves = (webclient, callback) => {
	webclient.on('testForm', (data) => {
		console.log(data);
		let APIStatus = APIStatusFunc.getAPIStatus();
		let apiId = data.apiId;
		let serversName = data.serversName;
		serversName.map((serverName) => {
			APIStatus[apiId].servers[serverName].status = "Testing";
			APIStatus[apiId].servers[serverName].progress = 0;
			APIStatus[apiId].servers[serverName].totalProgress = 20;
			APIStatusFunc.writeAPIStatus(APIStatus);
			socketServerFunc.emitAPIStatusUpdate();
			callback({apiId: apiId, serverId: serverName}, APIStatus);
		});
	})
}

module.exports = {
	onAPIStatus: onAPIStatus,
	onAddTestServer: onAddTestServer,
	onDeleteServer: onDeleteServer,
	createApiDeletion: createApiDeletion,
	createPlannedTestForSlaves: createSendTestToSlaves
};