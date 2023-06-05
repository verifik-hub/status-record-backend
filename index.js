const verifikApi = require('./verifikApiService/index')
const cron = require('node-cron');

const {
    api: apiConfig,
    services: servicesConfig
} = require("./config")

const clientApi = verifikApi.initLibrary(apiConfig.clientToken, apiConfig.url)
const adminApi = verifikApi.initLibrary(apiConfig.adminToken, apiConfig.url)

clientApi.listServices().then(async (services) => {
    console.log("Total services: ", services.length)

    const timesForServices = {}

    for (const service of services) {
        const queryParams = servicesConfig[service.code]?.queryParams;

        if (!queryParams) {
            console.error(`Needs queryParams for ${service.code}`)
            continue
        }

        const currentTime = servicesConfig[service.code].time ?? servicesConfig.timeDefault

        if (!timesForServices[currentTime]) {
            timesForServices[currentTime] = []
        }

        timesForServices[currentTime].push([service, queryParams])
    }

    for (const time in timesForServices) {
        const serviceForJob = timesForServices[time]

        cron.schedule(time, () => cronJob(serviceForJob));
    }
}).catch(error => {
    console.log({
        error
    })
})

const cronJob = async (servicesForJob) => {
    for (const [currentExecService, queryParams] of servicesForJob) {
        const statusData = {
            code: currentExecService.code,
            group: currentExecService.group,
            status: 'failed',
        }

        try {
            const start = Date.now();

            const response = await clientApi.execServiceWithQueryparams(currentExecService, queryParams)

            const stop = Date.now();

            const isValidResponse = (servicesConfig[currentExecService.code].keysInResponse || []).every(key => response.data[key] !== undefined)

            statusData.status = isValidResponse ? 'ok' : 'failed'
            statusData.responseTime = (stop - start) / 1000

        } catch (error) {
            console.error("============\n", currentExecService.code, {
                error: error.message
            }, "============\n")
        }

        try {
            const response = await adminApi.execPostService(apiConfig.statusPath, statusData);

            if (response.data.status !== 'ok') {
                console.error("============\n", {
                    response
                }, "============\n")
            }

        } catch (error) {
            console.error({
                data: error.response?.data,
                error: error.response
            })
        }

    }
}