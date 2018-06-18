const { MicroserviceError } = require('@joinbox/loopback-microservice');
module.exports = class UnsupportedDatasourceError extends MicroserviceError {};