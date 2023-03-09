const axios = require('axios')

class verifikLibrary {
    #instanceAxios

    constructor(instanceAxios) {
        this.#instanceAxios = instanceAxios;
      }

    async listServices() {
        if (!this.#instanceAxios) {
            throw new Error('Library not started')
        }

        const {
            data
        } = await this.#instanceAxios.get('/v2/app-features?where_group=apiRequest&where_isAvailable=true&sort=code&legacy=false');

        return data.data

    }

    async execServiceWithQueryparams(service, queryParams) {
        const params = new URLSearchParams(queryParams);
        let queryString = `/${service.url}?`;

        for (const dependency of service.dependencies) {
            const currentParam = params.get(dependency.field)

            if (dependency.required && !currentParam) {
                throw new Error(`Missing required field: ${dependency.field}`);
            }

            if (dependency.enum && !dependency.enum.includes(currentParam)) {
                throw new Error(`Invalid value for field ${dependency.field}: ${currentParam}`);
            }

            queryString += `${dependency.field}=${currentParam}&`;
        }

        const {
            data
        } = await this.#instanceAxios.get(queryString);

        return data;
    };

    async execPostService(path, body) {
        const {
            data
        } = await this.#instanceAxios.post(path,body);

        return data;
    };
}

const initLibrary = (token, apiUrl = 'https://app.verifik.co') => {
    if (!token) {
        throw new Error('Needs token')
    }

    if (!apiUrl) {
        throw new Error('Needs api url')
    }

    const instanceVerifikService = axios.create({
        baseURL: apiUrl,
        timeout: 0,
    });

    instanceVerifikService.defaults.headers.common['Authorization'] = `JWT ${token}`

    return new verifikLibrary(instanceVerifikService)
}

module.exports = {
    initLibrary,
}