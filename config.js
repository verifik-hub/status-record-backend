require("dotenv-json-complex")();

module.exports = JSON.parse(process.env.config) ?? {}