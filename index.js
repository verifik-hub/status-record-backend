const verifikApi = require("./verifikApiService/index");
const cron = require("node-cron");

const { api: apiConfig, services: servicesConfig } = require("./config");

const clientApi = verifikApi.initLibrary(apiConfig.clientToken, apiConfig.url);
const adminApi = verifikApi.initLibrary(apiConfig.adminToken, apiConfig.url);

clientApi
	.listServices()
	.then(async (services) => {
		const timesForServices = {};
		const needsQueryParams = [];

		for (const service of services) {
			const queryParams = servicesConfig[service.code]?.queryParams;

			if (!queryParams) {
				needsQueryParams.push(service.code);
				// console.error(`Needs queryParams for ${service.code}`);
				continue;
			}

			const currentTime = servicesConfig[service.code].time ?? servicesConfig.timeDefault;

			if (!timesForServices[currentTime]) {
				timesForServices[currentTime] = [];
			}

			timesForServices[currentTime].push([service, queryParams]);
		}
		console.log(" =================================================== ");
		console.log("Total services: ", services.length);

		if (needsQueryParams.length) {
			console.log("Total without params: ", needsQueryParams.length);
			console.error(needsQueryParams);
		}
		console.log(" =================================================== ");

		for (const time in timesForServices) {
			const serviceForJob = timesForServices[time];

			cron.schedule(time, () => cronJob(serviceForJob));
		}
	})
	.catch((error) => {
		console.log({
			error,
		});
	});

const cronJob = async (servicesForJob) => {
	for (const [currentExecService, queryParams] of servicesForJob) {
		const statusData = {
			name: currentExecService.name,
			code: currentExecService.code,
			group: currentExecService.group,
			status: "failed",
		};
		let errorBody = {};

		try {
			const start = Date.now();

			const response = await clientApi.execServiceWithQueryparams(currentExecService, queryParams);

			const stop = Date.now();

			const isValidResponse = (servicesConfig[currentExecService.code].keysInResponse || []).every((key) => response.data[key] !== undefined);

			if (!isValidResponse) {
				errorBody = {
					requiredKeys: servicesConfig[currentExecService.code].keysInResponse,
					currentKeys: Object.keys(response.data),
				};
			}

			statusData.status = isValidResponse ? "ok" : "failed";
			statusData.responseTime = (stop - start) / 1000;
		} catch (error) {
			if (error.response) {
				errorBody = error.response?.data || error.message;
				delete errorBody.signature;
			}
		}

		try {
			const { data: response } = await adminApi.execPostService(apiConfig.statusPath, statusData);

			if (response.status !== "ok") {
				delete response.updatedAt;
				console.error("========================");
				console.error(currentExecService.code, "\n", errorBody, "\n", response);
				console.error("========================\n");
			}
		} catch (error) {
			console.log(error.message);
			console.error("========================\n", error.response, "\n========================\n");
		}
	}
};
